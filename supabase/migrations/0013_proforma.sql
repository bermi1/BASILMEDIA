-- Basil Media OS · 0013 Proforma invoices
-- A proforma sits between the quotation and the tax invoice: quotation → proforma → invoice.
-- It is not a tax document (no VAT liability, no receivable); it lets the client raise a PO or
-- pay a deposit before the real invoice exists. Same shape as public.quotations (jsonb line items).
-- Owner rule: money documents (quotations, proformas, invoices) all sit with the GM/CFO,
-- who can also create, convert and record payments. Finance keeps its existing rights.
-- Runs after 0006 (quotations, invoices, next_doc_number, doc_total) and 0005 (clients, projects).

-- ---------------------------------------------------------------- numbering
-- Adds the proforma series to the numbering setting (kept if an admin already set one).
update public.app_settings
   set value = jsonb_build_object('proforma', 'BM-PF-{YYYY}-{0000}') || value
 where key = 'numbering' and not (value ? 'proforma');

-- ---------------------------------------------------------------- table
create table public.proformas (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  quotation_id uuid references public.quotations (id),
  prospect text not null default '',
  title text not null default '',
  items jsonb not null default '[]', -- [{title, detail, qty, unit_price}]
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'expired', 'cancelled')),
  sent_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  invoice_id uuid references public.invoices (id),
  notes text not null default '',
  terms text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index proformas_quotation_idx on public.proformas (quotation_id);
create index proformas_client_idx on public.proformas (client_id);

alter table public.invoices add column if not exists proforma_id uuid references public.proformas (id);
create index if not exists invoices_proforma_idx on public.invoices (proforma_id);

create or replace function public.number_proforma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_doc_number('proforma');
  end if;
  return new;
end;
$$;
create trigger number_proformas before insert on public.proformas for each row execute function public.number_proforma();

-- ---------------------------------------------------------------- RLS (mirrors quotations)
alter table public.proformas enable row level security;
create policy "sales roles read proformas" on public.proformas for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager', 'growth']::public.app_role[]));
create policy "sales roles write proformas" on public.proformas for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]));

-- The GM/CFO owns all money documents, so they may also record a client payment against an invoice
-- (0006 allowed Finance only). The receipt number, income posting and status still come from the 0006 triggers.
create policy "gm records payments" on public.invoice_payments for insert to authenticated
  with check (public.has_role(auth.uid(), 'gm_cfo'));

create trigger audit_proformas after insert or update or delete on public.proformas for each row execute function public.audit_row();

-- ---------------------------------------------------------------- workflow
-- Quotation → proforma: copies client, project, lines, discount and VAT; marks the quotation accepted.
create or replace function public.convert_quotation_to_proforma(_quotation_id uuid, _valid_until date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); q public.quotations; pid uuid;
begin
  if not public.has_any_role(me, array['gm_cfo', 'finance', 'boss']::public.app_role[]) then
    raise exception 'Only the GM/CFO or Finance can raise a proforma';
  end if;
  select * into q from public.quotations where id = _quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status not in ('sent', 'viewed', 'accepted') then raise exception 'Only a sent or accepted quotation can become a proforma (this one is %)', q.status; end if;
  if q.invoice_id is not null then raise exception 'This quotation is already invoiced'; end if;
  if exists (select 1 from public.proformas where quotation_id = q.id and status <> 'cancelled') then
    raise exception 'This quotation already has a proforma';
  end if;
  if jsonb_array_length(q.items) = 0 then raise exception 'The quotation has no line items'; end if;
  insert into public.proformas (client_id, project_id, quotation_id, prospect, title, items, discount, vat_on, vat_rate, issue_date, valid_until, notes, terms, created_by)
  values (q.client_id, q.project_id, q.id, q.prospect, q.title, q.items, q.discount, q.vat_on, q.vat_rate, current_date,
          coalesce(_valid_until, current_date + 30), q.notes, 'Payment by bank transfer or mobile money. Quote the proforma number as reference.', me)
  returning id into pid;
  update public.quotations set status = 'accepted', accepted_at = coalesce(accepted_at, now()) where id = q.id;
  return pid;
end;
$$;

-- Proforma → tax invoice: creates the real invoice (proforma_id + quotation_id linked, lines copied,
-- 50/50 deposit schedule) and marks the proforma accepted.
create or replace function public.convert_proforma_to_invoice(_id uuid, _due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.proformas; iid uuid; total numeric; due date := coalesce(_due_date, current_date + 14);
begin
  if not public.has_any_role(me, array['gm_cfo', 'finance', 'boss']::public.app_role[]) then
    raise exception 'Only the GM/CFO or Finance can raise an invoice';
  end if;
  select * into p from public.proformas where id = _id for update;
  if not found then raise exception 'Proforma not found'; end if;
  if p.invoice_id is not null then raise exception 'This proforma is already invoiced'; end if;
  if p.status not in ('sent', 'accepted') then raise exception 'Send the proforma before invoicing it (this one is %)', p.status; end if;
  if p.client_id is null then raise exception 'Add % as a client before invoicing', coalesce(nullif(p.prospect, ''), 'the prospect'); end if;
  if jsonb_array_length(p.items) = 0 then raise exception 'The proforma has no line items'; end if;
  total := public.doc_total(p.items, p.discount, p.vat_on, p.vat_rate);
  insert into public.invoices (client_id, project_id, quotation_id, proforma_id, title, items, discount, vat_on, vat_rate, deposit, schedule, issue_date, due_date, status, notes, terms, created_by)
  values (p.client_id, p.project_id, p.quotation_id, p.id, p.title, p.items, p.discount, p.vat_on, p.vat_rate, round(total / 2),
          jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pct', 50, 'due', due), jsonb_build_object('label', 'On delivery', 'pct', 50, 'due', due + 31)),
          current_date, due, 'draft', p.notes, p.terms, me)
  returning id into iid;
  update public.proformas set status = 'accepted', accepted_at = coalesce(accepted_at, now()), invoice_id = iid where id = p.id;
  if p.quotation_id is not null then
    update public.quotations set invoice_id = iid where id = p.quotation_id and invoice_id is null;
  end if;
  return iid;
end;
$$;

-- Daily job: 0006's overdue/expiry sweep, now also expiring proformas past their validity.
create or replace function public.mark_overdue_finance()
returns void language sql security definer set search_path = public as $$
  update public.invoices set status = 'overdue' where status in ('sent', 'viewed', 'partially_paid') and due_date < current_date
    and coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = invoices.id), 0) < public.doc_total(items, discount, vat_on, vat_rate);
  update public.quotations set status = 'expired' where status in ('draft', 'sent', 'viewed') and valid_until < current_date;
  update public.proformas set status = 'expired' where status in ('draft', 'sent') and valid_until < current_date and invoice_id is null;
$$;
revoke execute on function public.mark_overdue_finance() from public, anon, authenticated;

revoke execute on function public.convert_quotation_to_proforma(uuid, date) from public, anon;
revoke execute on function public.convert_proforma_to_invoice(uuid, date) from public, anon;
grant execute on function public.convert_quotation_to_proforma(uuid, date), public.convert_proforma_to_invoice(uuid, date) to authenticated;

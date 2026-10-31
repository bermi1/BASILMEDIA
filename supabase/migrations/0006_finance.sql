-- Basil Media OS · 0006 Finance & Approvals
-- Money requests with a segregated approval chain (requester → GM/CFO → Boss → Finance → retire → reconcile),
-- project budget lines, income/expenses, quotations, invoices with payments and receipts, and payroll lite.
-- Every workflow transition is a SECURITY DEFINER function that checks role AND segregation of duties.
-- Settings (approval_limits, vat_rate, statutory_rates, numbering, retirement_days, block_on_unretired)
-- come from public.app_settings (0004). Clients and projects come from 0005 (only altered here).

-- ---------------------------------------------------------------- helpers
alter table public.projects add column if not exists budget numeric(14, 2) not null default 0;
alter table public.projects add column if not exists contract_value numeric(14, 2) not null default 0;

create or replace function public.fin_setting(_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = _key;
$$;

create or replace function public.is_staff(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and role <> 'client');
$$;

-- Document numbering from app_settings.numbering, e.g. "BM-INV-{YYYY}-{0000}". Yearly counters reset each year.
create table public.doc_counters (
  kind text not null,
  year int not null,
  last int not null default 0,
  primary key (kind, year)
);
alter table public.doc_counters enable row level security; -- no policies: only definer functions touch it

create or replace function public.next_doc_number(_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare
  fmt text := coalesce(public.fin_setting('numbering') ->> _kind, 'BM-' || upper(_kind) || '-{0000}');
  yr int := extract(year from (now() at time zone 'Africa/Dar_es_Salaam'))::int;
  bucket int := case when position('{YYYY}' in fmt) > 0 then yr else 0 end;
  n int;
begin
  insert into public.doc_counters (kind, year, last) values (_kind, bucket, 1)
  on conflict (kind, year) do update set last = public.doc_counters.last + 1
  returning last into n;
  return replace(replace(fmt, '{YYYY}', yr::text), '{0000}', lpad(n::text, 4, '0'));
end;
$$;
revoke execute on function public.next_doc_number(text) from public, anon;
grant execute on function public.next_doc_number(text) to authenticated;

-- Progressive PAYE from bands [[upper, rate%], …, [null, rate%]].
create or replace function public.paye_for(_taxable numeric, _bands jsonb)
returns numeric language plpgsql immutable as $$
declare lo numeric := 0; tax numeric := 0; b jsonb; hi numeric; rate numeric;
begin
  for b in select value from jsonb_array_elements(coalesce(_bands, '[]')) loop
    hi := case when jsonb_typeof(b -> 0) = 'null' then null else (b ->> 0)::numeric end;
    rate := (b ->> 1)::numeric;
    if hi is null or _taxable <= hi then
      tax := tax + greatest(_taxable - lo, 0) * rate / 100;
      exit;
    end if;
    tax := tax + (hi - lo) * rate / 100;
    lo := hi;
  end loop;
  return round(tax);
end;
$$;

-- Line-items total: sum(qty × unit_price) − discount, plus VAT when on.
create or replace function public.doc_total(_items jsonb, _discount numeric, _vat_on boolean, _vat_rate numeric)
returns numeric language sql immutable as $$
  select round(
    greatest(coalesce((select sum((i ->> 'qty')::numeric * (i ->> 'unit_price')::numeric) from jsonb_array_elements(coalesce(_items, '[]')) i), 0) - coalesce(_discount, 0), 0)
    * (1 + case when _vat_on then coalesce(_vat_rate, 0) / 100 else 0 end)
  );
$$;

-- ---------------------------------------------------------------- reference lists
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (division_id, name)
);
insert into public.expense_categories (name, sort_order) values
  ('Crew', 1), ('Transport', 2), ('Equipment hire', 3), ('Per diem & meals', 4), ('Location & permits', 5),
  ('Post-production', 6), ('Music & licences', 7), ('Printing', 8), ('Contingency', 9), ('Salaries', 10),
  ('Rent & utilities', 11), ('Software & subscriptions', 12), ('Equipment repairs', 13), ('Marketing', 14),
  ('Bank & mobile money charges', 15), ('Office & petty cash', 16);

create table public.price_items (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  detail text not null default '',
  unit text not null default 'item',
  unit_price numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  name text not null,
  kind text not null check (kind in ('cash', 'bank', 'mobile')),
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- budgets
create table public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  line text not null check (line in ('Crew', 'Transport', 'Equipment hire', 'Per diem & meals', 'Location & permits', 'Post-production', 'Music & licences', 'Printing', 'Contingency')),
  allocated numeric(14, 2) not null default 0 check (allocated >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, line)
);

-- ---------------------------------------------------------------- money requests
create table public.money_requests (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text not null unique,
  requester_id uuid not null references auth.users (id),
  project_id uuid references public.projects (id),
  budget_line_id uuid references public.project_budget_lines (id),
  amount numeric(14, 2) not null default 0,
  approved_amount numeric(14, 2),
  purpose text not null default '',
  category text not null default '',
  needed_by date,
  payee text not null default '',
  payee_phone text not null default '',
  method text not null default 'M-Pesa' check (method in ('M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa', 'Bank transfer', 'Cash')),
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent', 'critical')),
  attachment_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'gm_review', 'boss_approval', 'approved', 'paid', 'retired', 'reconciled', 'returned', 'rejected')),
  question text,
  recommendation text not null default '',
  over_budget boolean not null default false,
  duplicate_of uuid references public.money_requests (id),
  submitted_at timestamptz,
  stage_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  approved_alone boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references auth.users (id),
  paid_method text,
  paid_reference text,
  paid_proof_url text,
  paid_account_id uuid references public.finance_accounts (id),
  retired_at timestamptz,
  change_returned numeric(14, 2) not null default 0,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users (id),
  returned_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.money_requests (status);
create index on public.money_requests (requester_id, created_at desc);

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  request_id uuid not null references public.money_requests (id) on delete cascade,
  step text not null check (step in ('submit', 'review', 'approve', 'answer', 'pay', 'retire', 'reconcile')),
  actor_id uuid not null references auth.users (id),
  decision text not null,
  comment text not null default '',
  amount numeric(14, 2),
  device text not null default '',
  verified_by text check (verified_by in ('pin', 'passkey')),
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.approval_steps (request_id, at);

create table public.retirements (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  request_id uuid not null references public.money_requests (id) on delete cascade,
  receipts jsonb not null default '[]', -- [{url, amount, note}]
  total_spent numeric(14, 2) not null default 0,
  change_returned numeric(14, 2) not null default 0,
  note text not null default '',
  retired_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- income & expenses
create table public.income (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid references public.finance_accounts (id),
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  invoice_id uuid,
  payment_id uuid,
  category text not null default 'Client payment',
  description text not null default '',
  reference text not null default '',
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount >= 0),
  category text not null,
  account_id uuid references public.finance_accounts (id),
  project_id uuid references public.projects (id),
  budget_line_id uuid references public.project_budget_lines (id),
  request_id uuid references public.money_requests (id),
  payroll_run_id uuid,
  payee text not null default '',
  description text not null default '',
  receipt_url text not null default '',
  petty_cash boolean not null default false,
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

-- Committed / spent / remaining per budget line.
create or replace view public.project_budget_line_totals with (security_invoker = true) as
  select l.id, l.project_id, l.line, l.allocated,
    coalesce((select sum(coalesce(r.approved_amount, r.amount)) from public.money_requests r where r.budget_line_id = l.id and r.status = 'approved'), 0) as committed,
    coalesce((select sum(r.amount) from public.money_requests r where r.budget_line_id = l.id and r.status in ('submitted', 'gm_review', 'boss_approval')), 0) as pending,
    coalesce((select sum(coalesce(r.approved_amount, r.amount) - r.change_returned) from public.money_requests r where r.budget_line_id = l.id and r.status in ('paid', 'retired', 'reconciled')), 0)
      + coalesce((select sum(e.amount) from public.expenses e where e.budget_line_id = l.id and e.request_id is null), 0) as spent,
    l.allocated
      - coalesce((select sum(coalesce(r.approved_amount, r.amount)) from public.money_requests r where r.budget_line_id = l.id and r.status = 'approved'), 0)
      - coalesce((select sum(coalesce(r.approved_amount, r.amount) - r.change_returned) from public.money_requests r where r.budget_line_id = l.id and r.status in ('paid', 'retired', 'reconciled')), 0)
      - coalesce((select sum(e.amount) from public.expenses e where e.budget_line_id = l.id and e.request_id is null), 0) as remaining
  from public.project_budget_lines l;

-- ---------------------------------------------------------------- quotations & invoices
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  prospect text not null default '',
  title text not null default '',
  items jsonb not null default '[]', -- [{title, detail, qty, unit_price}]
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 30),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  invoice_id uuid,
  notes text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  number text unique,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  quotation_id uuid references public.quotations (id),
  title text not null default '',
  po_ref text not null default '',
  items jsonb not null default '[]',
  discount numeric(14, 2) not null default 0,
  vat_on boolean not null default true,
  vat_rate numeric(5, 2) not null default 18,
  deposit numeric(14, 2) not null default 0,
  schedule jsonb not null default '[]', -- [{label, pct, due}]
  issue_date date not null default current_date,
  due_date date not null default (current_date + 14),
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  notes text not null default '',
  terms text not null default '',
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.quotations add constraint quotations_invoice_fk foreign key (invoice_id) references public.invoices (id);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'Bank transfer',
  reference text not null default '',
  account_id uuid references public.finance_accounts (id),
  receipt_no text unique,
  is_deposit boolean not null default false,
  recorded_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.income add constraint income_invoice_fk foreign key (invoice_id) references public.invoices (id) on delete set null;
alter table public.income add constraint income_payment_fk foreign key (payment_id) references public.invoice_payments (id) on delete cascade;

create or replace function public.number_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_doc_number(case tg_table_name when 'invoices' then 'invoice' else 'quotation' end);
  end if;
  return new;
end;
$$;
create trigger number_invoices before insert on public.invoices for each row execute function public.number_document();
create trigger number_quotations before insert on public.quotations for each row execute function public.number_document();

-- A payment gets a receipt number, posts to income and moves the invoice status.
create or replace function public.before_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.receipt_no is null or new.receipt_no = '' then new.receipt_no := public.next_doc_number('receipt'); end if;
  return new;
end;
$$;
create or replace function public.after_invoice_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invoices; total numeric; paid numeric;
begin
  select * into inv from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if tg_op = 'INSERT' then
    insert into public.income (date, amount, account_id, client_id, project_id, invoice_id, payment_id, description, reference, recorded_by)
    values (new.paid_on, new.amount, new.account_id, inv.client_id, inv.project_id, inv.id, new.id, 'Payment · ' || inv.number, new.reference, new.recorded_by);
  end if;
  total := public.doc_total(inv.items, inv.discount, inv.vat_on, inv.vat_rate);
  select coalesce(sum(amount), 0) into paid from public.invoice_payments where invoice_id = inv.id;
  update public.invoices set
    status = case when inv.status = 'cancelled' then 'cancelled'
                  when paid >= total and total > 0 then 'paid'
                  when paid > 0 then 'partially_paid'
                  when inv.due_date < current_date and inv.status <> 'draft' then 'overdue'
                  else case when inv.status in ('paid', 'partially_paid') then 'sent' else inv.status end end,
    paid_at = case when paid >= total and total > 0 then now() else null end
  where id = inv.id;
  return coalesce(new, old);
end;
$$;
create trigger before_invoice_payment before insert on public.invoice_payments for each row execute function public.before_invoice_payment();
create trigger after_invoice_payment after insert or delete on public.invoice_payments for each row execute function public.after_invoice_payment();

-- Run daily (pg_cron) to flag overdue invoices and expire quotations.
create or replace function public.mark_overdue_finance()
returns void language sql security definer set search_path = public as $$
  update public.invoices set status = 'overdue' where status in ('sent', 'viewed', 'partially_paid') and due_date < current_date
    and coalesce((select sum(amount) from public.invoice_payments p where p.invoice_id = invoices.id), 0) < public.doc_total(items, discount, vat_on, vat_rate);
  update public.quotations set status = 'expired' where status in ('draft', 'sent', 'viewed') and valid_until < current_date;
$$;
revoke execute on function public.mark_overdue_finance() from public, anon, authenticated;

-- ---------------------------------------------------------------- payroll lite
create table public.salary_profiles (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  user_id uuid not null unique references auth.users (id),
  full_name text not null default '',
  title text not null default '',
  basic numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  deductions numeric(14, 2) not null default 0, -- loans, advances, other
  pay_method text not null default 'Bank transfer',
  pay_account text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  period text not null, -- YYYY-MM
  pay_day date not null,
  status text not null default 'prepared' check (status in ('prepared', 'reviewed', 'approved', 'paid', 'returned')),
  headcount int not null default 0,
  gross numeric(14, 2) not null default 0,
  paye numeric(14, 2) not null default 0,
  nssf_employee numeric(14, 2) not null default 0,
  nssf_employer numeric(14, 2) not null default 0,
  wcf numeric(14, 2) not null default 0,
  sdl numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  rates jsonb not null default '{}',
  comment text not null default '',
  prepared_by uuid references auth.users (id), prepared_at timestamptz,
  reviewed_by uuid references auth.users (id), reviewed_at timestamptz,
  approved_by uuid references auth.users (id), approved_at timestamptz, verified_by text,
  paid_by uuid references auth.users (id), paid_at timestamptz, paid_reference text,
  created_at timestamptz not null default now(),
  unique (division_id, period)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  division_id text not null default 'basil-media' references public.divisions (id),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  full_name text not null default '',
  title text not null default '',
  basic numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  gross numeric(14, 2) not null default 0,
  nssf numeric(14, 2) not null default 0,
  taxable numeric(14, 2) not null default 0,
  paye numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  net numeric(14, 2) not null default 0,
  nssf_employer numeric(14, 2) not null default 0,
  wcf numeric(14, 2) not null default 0,
  sdl numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.expenses add constraint expenses_payroll_fk foreign key (payroll_run_id) references public.payroll_runs (id) on delete set null;

-- ---------------------------------------------------------------- RLS
alter table public.expense_categories enable row level security;
alter table public.price_items enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.project_budget_lines enable row level security;
alter table public.money_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.retirements enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.quotations enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.salary_profiles enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;

create policy "staff read categories" on public.expense_categories for select to authenticated using (public.is_staff(auth.uid()));
create policy "finance edits categories" on public.expense_categories for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));

create policy "staff read price list" on public.price_items for select to authenticated using (public.is_staff(auth.uid()));
create policy "finance edits price list" on public.price_items for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo', 'account_manager']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo', 'account_manager']::public.app_role[]));

create policy "money roles read accounts" on public.finance_accounts for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "gm edits accounts" on public.finance_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'gm_cfo')) with check (public.has_role(auth.uid(), 'gm_cfo'));

create policy "staff read budget lines" on public.project_budget_lines for select to authenticated using (public.is_staff(auth.uid()));
create policy "leaders set budgets" on public.project_budget_lines for all to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['boss', 'gm_cfo']::public.app_role[]));

create policy "see own or money roles" on public.money_requests for select to authenticated
  using (requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "requester starts a draft" on public.money_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'draft' and public.is_staff(auth.uid()));
create policy "requester edits own draft" on public.money_requests for update to authenticated
  using (requester_id = auth.uid() and status in ('draft', 'returned')) with check (requester_id = auth.uid() and status in ('draft', 'returned'));
create policy "requester deletes own draft" on public.money_requests for delete to authenticated using (requester_id = auth.uid() and status = 'draft');
-- Every transition after the draft goes through submit_money_request and the other definer functions.

create policy "steps follow request" on public.approval_steps for select to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and (r.requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]))));
create policy "retirements follow request" on public.retirements for select to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and (r.requester_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]))));

create policy "money roles read income" on public.income for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance records income" on public.income for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));
create policy "money roles read expenses" on public.expenses for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance records expenses" on public.expenses for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));

create policy "sales roles read quotations" on public.quotations for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager', 'growth']::public.app_role[]));
create policy "sales roles write quotations" on public.quotations for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "money roles read invoices" on public.invoices for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "finance writes invoices" on public.invoices for all to authenticated
  using (public.has_any_role(auth.uid(), array['gm_cfo', 'finance']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['gm_cfo', 'finance']::public.app_role[]));
create policy "money roles read payments" on public.invoice_payments for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance', 'account_manager']::public.app_role[]));
create policy "finance records payments" on public.invoice_payments for insert to authenticated with check (public.has_role(auth.uid(), 'finance'));
create policy "finance removes payments" on public.invoice_payments for delete to authenticated using (public.has_role(auth.uid(), 'finance'));

create policy "own salary or money roles" on public.salary_profiles for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "finance edits salary profiles" on public.salary_profiles for all to authenticated
  using (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['finance', 'gm_cfo']::public.app_role[]));
create policy "money roles read payroll" on public.payroll_runs for select to authenticated using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[]));
create policy "own payslips once paid" on public.payslips for select to authenticated
  using (public.has_any_role(auth.uid(), array['boss', 'gm_cfo', 'finance']::public.app_role[])
         or (user_id = auth.uid() and exists (select 1 from public.payroll_runs pr where pr.id = run_id and pr.status = 'paid')));

-- ---------------------------------------------------------------- audit
create trigger audit_expense_categories after insert or update or delete on public.expense_categories for each row execute function public.audit_row();
create trigger audit_price_items after insert or update or delete on public.price_items for each row execute function public.audit_row();
create trigger audit_finance_accounts after insert or update or delete on public.finance_accounts for each row execute function public.audit_row();
create trigger audit_project_budget_lines after insert or update or delete on public.project_budget_lines for each row execute function public.audit_row();
create trigger audit_money_requests after insert or update or delete on public.money_requests for each row execute function public.audit_row();
create trigger audit_approval_steps after insert or update or delete on public.approval_steps for each row execute function public.audit_row();
create trigger audit_retirements after insert or update or delete on public.retirements for each row execute function public.audit_row();
create trigger audit_income after insert or update or delete on public.income for each row execute function public.audit_row();
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_row();
create trigger audit_quotations after insert or update or delete on public.quotations for each row execute function public.audit_row();
create trigger audit_invoices after insert or update or delete on public.invoices for each row execute function public.audit_row();
create trigger audit_invoice_payments after insert or update or delete on public.invoice_payments for each row execute function public.audit_row();
create trigger audit_salary_profiles after insert or update or delete on public.salary_profiles for each row execute function public.audit_row();
create trigger audit_payroll_runs after insert or update or delete on public.payroll_runs for each row execute function public.audit_row();
create trigger audit_payslips after insert or update or delete on public.payslips for each row execute function public.audit_row();

-- ---------------------------------------------------------------- approval engine
create or replace function public.mr_line_category(_line uuid)
returns text language sql stable security definer set search_path = public as $$
  select line from public.project_budget_lines where id = _line;
$$;

-- Requester submits (or re-submits a returned request). GM/CFO requesters go straight to the Boss.
create or replace function public.submit_money_request(_data jsonb, _id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.money_requests;
  days int := coalesce((public.fin_setting('retirement_days') #>> '{}')::int, 3);
  blocking boolean := coalesce((public.fin_setting('block_on_unretired') #>> '{}')::boolean, true);
  is_gm boolean := public.has_role(me, 'gm_cfo') and not public.has_role(me, 'super_admin');
  was_returned boolean := false;
  rem numeric; dup uuid; nxt text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not public.is_staff(me) then raise exception 'Only staff can request money'; end if;
  if blocking and exists (select 1 from public.money_requests where requester_id = me and status = 'paid' and paid_at < now() - make_interval(days => days)) then
    raise exception 'Retire the receipts for your earlier advance before requesting more money';
  end if;
  if _id is null then
    insert into public.money_requests (number, requester_id) values (public.next_doc_number('request'), me) returning * into r;
  else
    select * into r from public.money_requests where id = _id for update;
    if not found then raise exception 'Request not found'; end if;
    if r.requester_id <> me then raise exception 'Only the requester can submit this request'; end if;
    if r.status not in ('draft', 'returned') then raise exception 'This request is already %', r.status; end if;
    was_returned := r.status = 'returned';
    if r.number like 'DRAFT-%' then
      update public.money_requests set number = public.next_doc_number('request') where id = r.id returning * into r;
    end if;
  end if;

  update public.money_requests set
    project_id = nullif(_data ->> 'project_id', '')::uuid,
    budget_line_id = nullif(_data ->> 'budget_line_id', '')::uuid,
    amount = coalesce((_data ->> 'amount')::numeric, 0),
    purpose = coalesce(_data ->> 'purpose', ''),
    category = coalesce(nullif(_data ->> 'category', ''), public.mr_line_category(nullif(_data ->> 'budget_line_id', '')::uuid), ''),
    needed_by = nullif(_data ->> 'needed_by', '')::date,
    payee = coalesce(_data ->> 'payee', ''),
    payee_phone = coalesce(_data ->> 'payee_phone', ''),
    method = coalesce(nullif(_data ->> 'method', ''), 'M-Pesa'),
    urgency = coalesce(nullif(_data ->> 'urgency', ''), 'normal'),
    attachment_url = coalesce(_data ->> 'attachment_url', '')
  where id = r.id returning * into r;

  if r.amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if length(trim(r.purpose)) < 3 then raise exception 'Say what the money is for'; end if;
  if r.budget_line_id is not null and not exists (select 1 from public.project_budget_lines where id = r.budget_line_id and project_id = r.project_id) then
    raise exception 'That budget line belongs to another project';
  end if;

  select remaining into rem from public.project_budget_line_totals where id = r.budget_line_id;
  select id into dup from public.money_requests
    where requester_id = me and id <> r.id and amount = r.amount and project_id is not distinct from r.project_id
      and status not in ('draft', 'rejected') and created_at > now() - interval '7 days'
    order by created_at desc limit 1;

  nxt := case when is_gm then 'boss_approval' else 'gm_review' end;
  update public.money_requests set status = nxt, submitted_at = now(), stage_at = now(), question = null,
    over_budget = coalesce(r.amount > rem, false), duplicate_of = dup, returned_at = null
  where id = r.id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount)
  values (r.id, 'submit', me, case when was_returned then 'resubmitted' else 'submitted' end, coalesce(_data ->> 'comment', ''), r.amount);

  if is_gm then
    perform public.notify_role('boss', 'Approval needed · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.purpose || ' · requested by GM/CFO', '/app?tab=approvals', 'approval');
  else
    perform public.notify_role('gm_cfo', 'New money request ' || r.number, r.purpose || ' · TSH ' || to_char(r.amount, 'FM999,999,999,990'), '/app?tab=review', 'money');
  end if;
  return r.id;
end;
$$;

-- GM/CFO: recommend (or approve alone under the limit) / return / reject.
create or replace function public.review_money_request(_id uuid, _decision text, _comment text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.money_requests;
  lim jsonb := coalesce(public.fin_setting('approval_limits'), '{}');
  alone_below numeric := coalesce((lim ->> 'gm_cfo_alone_below')::numeric, 0);
  cap numeric := coalesce((lim ->> 'gm_cfo_daily_cap')::numeric, 0);
  used numeric;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reviews money requests'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'gm_review' then raise exception 'This request is not waiting for review (it is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot review your own request'; end if;
  if _decision in ('return', 'reject') and length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Give a reason'; end if;

  if _decision = 'recommend' then
    select coalesce(sum(approved_amount), 0) into used from public.money_requests
      where approved_alone and approved_by = me and approved_at::date = current_date;
    if r.amount < alone_below and (cap = 0 or used + r.amount <= cap) then
      update public.money_requests set status = 'approved', approved_amount = r.amount, approved_by = me, approved_at = now(), approved_alone = true,
        reviewed_by = me, reviewed_at = now(), recommendation = coalesce(_comment, ''), stage_at = now() where id = _id;
      insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'approved_within_limit', coalesce(_comment, ''), r.amount);
      perform public.notify(r.requester_id, 'Request approved · ' || r.number, 'Approved by GM/CFO within limit. Finance will pay next.', '/app?tab=requests', 'money');
      perform public.notify_role('finance', 'Ready to pay · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.number || ' · ' || r.purpose, '/app?tab=queue', 'money');
      return 'approved';
    end if;
    update public.money_requests set status = 'boss_approval', reviewed_by = me, reviewed_at = now(), recommendation = coalesce(_comment, ''), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'recommended', coalesce(_comment, ''), r.amount);
    perform public.notify_role('boss', 'Approval needed · TSH ' || to_char(r.amount, 'FM999,999,999,990'), r.purpose || ' · recommended by GM/CFO', '/app?tab=approvals', 'approval');
    return 'boss_approval';
  elsif _decision = 'return' then
    update public.money_requests set status = 'returned', reviewed_by = me, reviewed_at = now(), returned_at = now(), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'returned', _comment, r.amount);
    perform public.notify(r.requester_id, 'Request returned · ' || r.number, _comment, '/app?tab=requests', 'money');
    return 'returned';
  elsif _decision = 'reject' then
    update public.money_requests set status = 'rejected', reviewed_by = me, reviewed_at = now(), rejected_at = now(), stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'review', me, 'rejected', _comment, r.amount);
    perform public.notify(r.requester_id, 'Request rejected · ' || r.number, _comment, '/app?tab=requests', 'money');
    return 'rejected';
  end if;
  raise exception 'Unknown decision %', _decision;
end;
$$;

-- Boss: approve / approve with a changed amount / reject / ask a question. Step-up (PIN or passkey) recorded.
create or replace function public.approve_money_request(_id uuid, _decision text, _amount numeric default null, _comment text default '', _verified_by text default null, _device text default '')
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; amt numeric;
begin
  if not public.has_role(me, 'boss') then raise exception 'Only the Boss approves money requests'; end if;
  if public.has_role(me, 'finance') and not public.has_role(me, 'super_admin') then raise exception 'Finance cannot approve payments'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'boss_approval' then raise exception 'This request is not waiting for the Boss (it is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot approve your own request'; end if;
  if r.reviewed_by = me then raise exception 'The reviewer and the approver must be different people'; end if;

  if _decision in ('approve', 'approve_changed') then
    if coalesce(_verified_by, '') not in ('pin', 'passkey') then raise exception 'Confirm with your fingerprint or PIN'; end if;
    amt := case when _decision = 'approve_changed' then _amount else r.amount end;
    if amt is null or amt <= 0 then raise exception 'Enter the approved amount'; end if;
    update public.money_requests set status = 'approved', approved_amount = amt, approved_by = me, approved_at = now(), question = null, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount, device, verified_by)
    values (_id, 'approve', me, case when amt <> r.amount then 'approved_changed' else 'approved' end, coalesce(_comment, ''), amt, coalesce(_device, ''), _verified_by);
    perform public.notify(r.requester_id, 'Approved · TSH ' || to_char(amt, 'FM999,999,999,990'), r.number || ' · Finance will pay next', '/app?tab=requests', 'money');
    perform public.notify_role('finance', 'Ready to pay · TSH ' || to_char(amt, 'FM999,999,999,990'), r.number || ' · ' || r.purpose, '/app?tab=queue', 'money');
    return 'approved';
  elsif _decision = 'reject' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Give a reason'; end if;
    update public.money_requests set status = 'rejected', rejected_at = now(), approved_by = me, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount, device, verified_by) values (_id, 'approve', me, 'rejected', _comment, r.amount, coalesce(_device, ''), _verified_by);
    perform public.notify(r.requester_id, 'Request rejected · ' || r.number, _comment, '/app?tab=requests', 'money');
    if r.reviewed_by is not null then perform public.notify(r.reviewed_by, 'Boss rejected ' || r.number, _comment, '', 'money'); end if;
    return 'rejected';
  elsif _decision = 'question' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Type your question'; end if;
    update public.money_requests set question = _comment where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'approve', me, 'question', _comment, r.amount);
    perform public.notify(r.requester_id, 'The Boss has a question · ' || r.number, _comment, '/app?tab=requests', 'approval');
    return 'question';
  end if;
  raise exception 'Unknown decision %', _decision;
end;
$$;

-- Requester answers the Boss's question.
create or replace function public.answer_money_request(_id uuid, _answer text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests;
begin
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.requester_id <> me then raise exception 'Only the requester can answer'; end if;
  if r.status <> 'boss_approval' or r.question is null then raise exception 'There is no open question'; end if;
  update public.money_requests set question = null where id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'answer', me, 'answered', _answer, r.amount);
  perform public.notify_role('boss', 'Answer on ' || r.number, _answer, '/app?tab=approvals', 'approval');
end;
$$;

-- Finance pays an approved request (never their own, never one they approved). Posts an expense.
create or replace function public.pay_money_request(_id uuid, _method text, _reference text, _proof_url text default '', _account_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; amt numeric;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance pays money requests'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'approved' then raise exception 'Only approved requests can be paid (this one is %)', r.status; end if;
  if r.requester_id = me then raise exception 'You cannot pay your own request'; end if;
  if r.approved_by = me then raise exception 'The approver cannot also pay'; end if;
  if _method <> 'Cash' and length(trim(coalesce(_reference, ''))) = 0 then raise exception 'Enter the transaction reference'; end if;
  amt := coalesce(r.approved_amount, r.amount);
  update public.money_requests set status = 'paid', paid_at = now(), paid_by = me, paid_method = _method, paid_reference = _reference,
    paid_proof_url = coalesce(_proof_url, ''), paid_account_id = _account_id, stage_at = now() where id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'pay', me, 'paid', _method || ' · ' || coalesce(_reference, ''), amt);
  insert into public.expenses (date, amount, category, account_id, project_id, budget_line_id, request_id, payee, description, receipt_url, petty_cash, recorded_by)
  values (current_date, amt, coalesce(nullif(r.category, ''), 'Contingency'), _account_id, r.project_id, r.budget_line_id, r.id, r.payee, r.number || ' · ' || r.purpose, coalesce(_proof_url, ''), _method = 'Cash', me);
  perform public.notify(r.requester_id, 'Paid · TSH ' || to_char(amt, 'FM999,999,999,990'),
    _method || ' ref ' || coalesce(_reference, '') || '. Retire receipts within ' || coalesce(public.fin_setting('retirement_days') #>> '{}', '3') || ' days.', '/app?tab=requests', 'money');
end;
$$;

-- Requester retires receipts (and returns change).
create or replace function public.retire_money_request(_id uuid, _receipts jsonb, _change numeric default 0, _note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests; spent numeric; amt numeric;
begin
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.requester_id <> me then raise exception 'Only the requester retires receipts'; end if;
  if r.status <> 'paid' then raise exception 'Only paid requests can be retired'; end if;
  if jsonb_array_length(coalesce(_receipts, '[]')) = 0 then raise exception 'Attach at least one receipt'; end if;
  amt := coalesce(r.approved_amount, r.amount);
  select coalesce(sum((x ->> 'amount')::numeric), 0) into spent from jsonb_array_elements(_receipts) x;
  if coalesce(_change, 0) < 0 or coalesce(_change, 0) > amt then raise exception 'Change returned must be between 0 and the amount paid'; end if;
  insert into public.retirements (request_id, receipts, total_spent, change_returned, note, retired_by) values (_id, _receipts, spent, coalesce(_change, 0), coalesce(_note, ''), me);
  update public.money_requests set status = 'retired', retired_at = now(), change_returned = coalesce(_change, 0), stage_at = now() where id = _id;
  update public.expenses set amount = greatest(amt - coalesce(_change, 0), 0) where request_id = _id;
  insert into public.approval_steps (request_id, step, actor_id, decision, comment, amount) values (_id, 'retire', me, 'retired', coalesce(_note, ''), spent);
  perform public.notify_role('gm_cfo', 'Receipts to reconcile · ' || r.number, 'TSH ' || to_char(spent, 'FM999,999,999,990') || ' in receipts', '/app?tab=more', 'money');
end;
$$;

-- GM/CFO reconciles retired receipts, or queries them back to the requester.
create or replace function public.reconcile_money_request(_id uuid, _decision text default 'ok', _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.money_requests;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reconciles'; end if;
  select * into r from public.money_requests where id = _id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'retired' then raise exception 'Only retired requests can be reconciled'; end if;
  if r.requester_id = me then raise exception 'You cannot reconcile your own request'; end if;
  if _decision = 'query' then
    if length(trim(coalesce(_comment, ''))) = 0 then raise exception 'Say what is wrong with the receipts'; end if;
    update public.money_requests set status = 'paid', retired_at = null, stage_at = now() where id = _id;
    delete from public.retirements where request_id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment) values (_id, 'reconcile', me, 'queried', _comment);
    perform public.notify(r.requester_id, 'Receipts queried · ' || r.number, _comment, '/app?tab=requests', 'money');
  else
    update public.money_requests set status = 'reconciled', reconciled_at = now(), reconciled_by = me, stage_at = now() where id = _id;
    insert into public.approval_steps (request_id, step, actor_id, decision, comment) values (_id, 'reconcile', me, 'reconciled', coalesce(_comment, ''));
  end if;
end;
$$;

-- ---------------------------------------------------------------- payroll workflow
-- Finance prepares (or re-prepares a returned run) from active salary profiles and statutory_rates.
create or replace function public.prepare_payroll_run(_period text, _pay_day date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  _rates jsonb := coalesce(public.fin_setting('statutory_rates'), '{}');
  run public.payroll_runs; p public.salary_profiles;
  v_gross numeric; v_nssf numeric; v_taxable numeric; v_paye numeric; v_net numeric;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance prepares payroll'; end if;
  select * into run from public.payroll_runs where period = _period and division_id = 'basil-media' for update;
  if found and run.status not in ('prepared', 'returned') then raise exception 'Payroll for % is already %', _period, run.status; end if;
  if not found then
    insert into public.payroll_runs (period, pay_day) values (_period, _pay_day) returning * into run;
  end if;
  delete from public.payslips where run_id = run.id;
  for p in select * from public.salary_profiles where active loop
    v_gross := p.basic + p.allowances;
    v_nssf := round(v_gross * coalesce((_rates ->> 'nssf_employee')::numeric, 0) / 100);
    v_taxable := v_gross - v_nssf;
    v_paye := public.paye_for(v_taxable, _rates -> 'paye_bands');
    v_net := v_gross - v_nssf - v_paye - p.deductions;
    insert into public.payslips (run_id, user_id, full_name, title, basic, allowances, gross, nssf, taxable, paye, other_deductions, net, nssf_employer, wcf, sdl)
    values (run.id, p.user_id, p.full_name, p.title, p.basic, p.allowances, v_gross, v_nssf, v_taxable, v_paye, p.deductions, v_net,
      round(v_gross * coalesce((_rates ->> 'nssf_employer')::numeric, 0) / 100), round(v_gross * coalesce((_rates ->> 'wcf')::numeric, 0) / 100), round(v_gross * coalesce((_rates ->> 'sdl')::numeric, 0) / 100));
  end loop;
  update public.payroll_runs pr set status = 'prepared', pay_day = _pay_day, rates = _rates, prepared_by = me, prepared_at = now(),
    reviewed_by = null, reviewed_at = null, approved_by = null, approved_at = null,
    headcount = s.n, gross = s.gross, paye = s.paye, nssf_employee = s.nssf, nssf_employer = s.nssf_er, wcf = s.wcf, sdl = s.sdl, other_deductions = s.other, net = s.net
  from (select count(*) n, coalesce(sum(ps.gross), 0) gross, coalesce(sum(ps.paye), 0) paye, coalesce(sum(ps.nssf), 0) nssf, coalesce(sum(ps.nssf_employer), 0) nssf_er,
          coalesce(sum(ps.wcf), 0) wcf, coalesce(sum(ps.sdl), 0) sdl, coalesce(sum(ps.other_deductions), 0) other, coalesce(sum(ps.net), 0) net
        from public.payslips ps where ps.run_id = run.id) s
  where pr.id = run.id;
  perform public.notify_role('gm_cfo', 'Payroll ' || _period || ' ready for review', '', '/app?tab=more', 'money');
  return run.id;
end;
$$;

create or replace function public.review_payroll_run(_id uuid, _decision text, _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs;
begin
  if not public.has_role(me, 'gm_cfo') then raise exception 'Only the GM/CFO reviews payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'prepared' then raise exception 'Payroll is not waiting for review'; end if;
  if run.prepared_by = me then raise exception 'The preparer cannot also review'; end if;
  if _decision = 'return' then
    update public.payroll_runs set status = 'returned', comment = _comment where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' returned', _comment, '', 'money');
  else
    update public.payroll_runs set status = 'reviewed', reviewed_by = me, reviewed_at = now(), comment = coalesce(_comment, '') where id = _id;
    perform public.notify_role('boss', 'Payroll ' || run.period || ' needs approval', 'TSH ' || to_char(run.net, 'FM999,999,999,990') || ' net', '/app?tab=approvals', 'approval');
  end if;
end;
$$;

create or replace function public.approve_payroll_run(_id uuid, _decision text, _comment text default '', _verified_by text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs;
begin
  if not public.has_role(me, 'boss') then raise exception 'Only the Boss approves payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'reviewed' then raise exception 'Payroll is not waiting for approval'; end if;
  if me in (run.prepared_by, run.reviewed_by) then raise exception 'Preparer, reviewer and approver must be different people'; end if;
  if _decision = 'return' then
    update public.payroll_runs set status = 'returned', comment = _comment where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' returned by the Boss', _comment, '', 'money');
  else
    if coalesce(_verified_by, '') not in ('pin', 'passkey') then raise exception 'Confirm with your fingerprint or PIN'; end if;
    update public.payroll_runs set status = 'approved', approved_by = me, approved_at = now(), verified_by = _verified_by where id = _id;
    perform public.notify_role('finance', 'Payroll ' || run.period || ' approved · pay now', '', '/app?tab=more', 'money');
  end if;
end;
$$;

create or replace function public.pay_payroll_run(_id uuid, _reference text, _account_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); run public.payroll_runs; s public.payslips;
begin
  if not public.has_role(me, 'finance') then raise exception 'Only Finance pays payroll'; end if;
  select * into run from public.payroll_runs where id = _id for update;
  if run.status <> 'approved' then raise exception 'Payroll must be approved by the Boss first'; end if;
  if run.approved_by = me then raise exception 'The approver cannot also pay'; end if;
  update public.payroll_runs set status = 'paid', paid_by = me, paid_at = now(), paid_reference = _reference where id = _id;
  insert into public.expenses (date, amount, category, account_id, payroll_run_id, payee, description, recorded_by)
  values (current_date, run.gross + run.nssf_employer + run.wcf + run.sdl, 'Salaries', _account_id, run.id, 'Staff payroll', 'Payroll ' || run.period || ' (gross + employer NSSF, WCF, SDL)', me);
  for s in select * from public.payslips where run_id = _id loop
    perform public.notify(s.user_id, 'Your payslip for ' || run.period || ' is ready', 'Net pay TSH ' || to_char(s.net, 'FM999,999,999,990'), '/app?tab=more', 'money');
  end loop;
end;
$$;

-- Only signed-in users may call the workflow functions (each checks roles itself).
revoke execute on function public.submit_money_request(jsonb, uuid) from public, anon;
revoke execute on function public.review_money_request(uuid, text, text) from public, anon;
revoke execute on function public.approve_money_request(uuid, text, numeric, text, text, text) from public, anon;
revoke execute on function public.answer_money_request(uuid, text) from public, anon;
revoke execute on function public.pay_money_request(uuid, text, text, text, uuid) from public, anon;
revoke execute on function public.retire_money_request(uuid, jsonb, numeric, text) from public, anon;
revoke execute on function public.reconcile_money_request(uuid, text, text) from public, anon;
revoke execute on function public.prepare_payroll_run(text, date) from public, anon;
revoke execute on function public.review_payroll_run(uuid, text, text) from public, anon;
revoke execute on function public.approve_payroll_run(uuid, text, text, text) from public, anon;
revoke execute on function public.pay_payroll_run(uuid, text, uuid) from public, anon;
grant execute on function public.submit_money_request(jsonb, uuid), public.review_money_request(uuid, text, text),
  public.approve_money_request(uuid, text, numeric, text, text, text), public.answer_money_request(uuid, text),
  public.pay_money_request(uuid, text, text, text, uuid), public.retire_money_request(uuid, jsonb, numeric, text),
  public.reconcile_money_request(uuid, text, text), public.prepare_payroll_run(text, date), public.review_payroll_run(uuid, text, text),
  public.approve_payroll_run(uuid, text, text, text), public.pay_payroll_run(uuid, text, uuid) to authenticated;

-- Basil Media OS · remove the sample data added by 0018_sample_data.sql.
-- Deletes only rows whose id starts with b5a5e000- (and what the database created from them,
-- such as income from sample payments). Your own records are not touched. Safe to run more than once.
do $$
declare t text;
begin
  delete from public.income where invoice_id::text like 'b5a5e000-%' or id::text like 'b5a5e000-%';
  delete from public.notifications where link like '%b5a5e000-%';
  foreach t in array array[
    'invoice_payments', 'invoices', 'money_requests', 'proformas', 'quotations', 'expenses', 'finance_accounts',
    'calendar_events', 'decisions', 'scoreboard_targets',
    'room_bookings', 'visitors', 'trips', 'vehicles', 'consumables', 'gear_kits', 'gear_items',
    'client_requests', 'allowance_ledger', 'retainer_calendar', 'retainers',
    'announcements', 'deliverables', 'shoot_crew', 'shoots', 'tasks', 'project_crew', 'project_budget_lines', 'projects',
    'growth_events', 'tenders', 'contracts', 'proposals', 'leads', 'crm_contacts', 'crm_organisations',
    'highlights', 'testimonials', 'partners']
  loop
    execute format('delete from public.%I where id::text like %L', t, 'b5a5e000-%');
  end loop;
  delete from public.client_users where client_id::text like 'b5a5e000-%';
  delete from public.clients where id::text like 'b5a5e000-%';
end $$;

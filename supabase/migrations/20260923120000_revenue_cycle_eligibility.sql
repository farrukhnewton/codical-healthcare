begin;

create table if not exists public.revenue_eligibility_checks (
  id text primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  created_by integer references public.users(id) on delete set null,
  provider text not null check (provider in ('availity', 'stedi', 'optum', 'claimmd')),
  environment text not null check (environment in ('demo', 'test', 'sandbox', 'production')),
  data_classification text not null check (data_classification in ('synthetic', 'phi')),
  scenario text not null,
  sample_profile text not null,
  service_type text not null,
  status text not null check (status in ('active', 'inactive', 'pending', 'error')),
  payer_id text,
  payer_name text,
  member_id_masked text,
  request_summary jsonb not null default '{}'::jsonb,
  normalized_response jsonb not null default '{}'::jsonb,
  external_transaction_id text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_eligibility_checks_org_checked_idx
  on public.revenue_eligibility_checks(organization_id, checked_at desc);
create index if not exists revenue_eligibility_checks_org_status_idx
  on public.revenue_eligibility_checks(organization_id, status);

drop trigger if exists set_revenue_eligibility_checks_updated_at on public.revenue_eligibility_checks;
create trigger set_revenue_eligibility_checks_updated_at
before update on public.revenue_eligibility_checks
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_eligibility_checks enable row level security;

drop policy if exists revenue_eligibility_checks_member_select on public.revenue_eligibility_checks;
create policy revenue_eligibility_checks_member_select on public.revenue_eligibility_checks
for select using (
  public.revenue_has_org_role(
    organization_id,
    array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[]
  )
);

drop policy if exists revenue_eligibility_checks_member_insert on public.revenue_eligibility_checks;
create policy revenue_eligibility_checks_member_insert on public.revenue_eligibility_checks
for insert with check (
  public.revenue_has_org_role(
    organization_id,
    array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[]
  )
);

drop policy if exists revenue_eligibility_checks_member_update on public.revenue_eligibility_checks;
create policy revenue_eligibility_checks_member_update on public.revenue_eligibility_checks
for update using (
  public.revenue_has_org_role(
    organization_id,
    array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[]
  )
) with check (
  public.revenue_has_org_role(
    organization_id,
    array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[]
  )
);

drop policy if exists revenue_eligibility_checks_admin_delete on public.revenue_eligibility_checks;
create policy revenue_eligibility_checks_admin_delete on public.revenue_eligibility_checks
for delete using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin']::text[])
);

commit;

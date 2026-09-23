begin;

create table if not exists public.revenue_authorizations (
  id text primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  created_by integer references public.users(id) on delete set null,
  provider text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  data_classification text not null check (data_classification in ('synthetic', 'phi')),
  scenario text not null,
  sample_profile text not null,
  status text not null check (status in ('not_required', 'approved', 'pended', 'denied')),
  payer_id text not null,
  payer_name text not null,
  member_id_masked text not null,
  procedure_code text not null,
  diagnosis_code text not null,
  service_from text not null,
  service_to text not null,
  requested_units numeric(10,3) not null default 1,
  authorization_number text,
  normalized_response jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_authorizations_org_checked_idx on public.revenue_authorizations(organization_id, checked_at desc);
create index if not exists revenue_authorizations_org_status_idx on public.revenue_authorizations(organization_id, status);

drop trigger if exists set_revenue_authorizations_updated_at on public.revenue_authorizations;
create trigger set_revenue_authorizations_updated_at before update on public.revenue_authorizations
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_authorizations enable row level security;

drop policy if exists revenue_authorizations_member_select on public.revenue_authorizations;
create policy revenue_authorizations_member_select on public.revenue_authorizations for select using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[])
);
drop policy if exists revenue_authorizations_member_insert on public.revenue_authorizations;
create policy revenue_authorizations_member_insert on public.revenue_authorizations for insert with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_authorizations_member_update on public.revenue_authorizations;
create policy revenue_authorizations_member_update on public.revenue_authorizations for update using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
) with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_authorizations_admin_delete on public.revenue_authorizations;
create policy revenue_authorizations_admin_delete on public.revenue_authorizations for delete using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin']::text[])
);

commit;

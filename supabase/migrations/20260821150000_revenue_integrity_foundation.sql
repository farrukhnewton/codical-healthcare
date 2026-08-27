begin;

create table if not exists public.revenue_organizations (
  id text primary key,
  slug text not null unique,
  name text not null,
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'suspended')),
  clearinghouse_provider text not null default 'stedi',
  created_by integer references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_organization_members (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  user_id integer not null references public.users(id) on delete cascade,
  role text not null default 'analyst' check (role in ('owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.revenue_claims (
  id text primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  patient_id integer references public.patients(id) on delete set null,
  encounter_id integer references public.encounters(id) on delete set null,
  patient_control_number text not null,
  claim_type text not null default 'professional' check (claim_type in ('professional', 'institutional')),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'ready', 'submitted', 'accepted', 'rejected', 'adjudicating', 'paid', 'partially_paid', 'denied', 'appealed', 'closed')),
  payer_id text not null,
  payer_name text not null,
  payer_claim_control_number text,
  service_from text not null,
  service_to text,
  billing_provider_npi text not null,
  rendering_provider_npi text,
  diagnosis_codes jsonb not null default '[]'::jsonb,
  total_charge numeric(14,2) not null default 0,
  expected_amount numeric(14,2),
  paid_amount numeric(14,2) not null default 0,
  integrity_score integer not null default 0 check (integrity_score between 0 and 100),
  risk_level text not null default 'unscored' check (risk_level in ('unscored', 'low', 'medium', 'high', 'critical')),
  clearinghouse_provider text not null default 'stedi',
  external_claim_id text,
  assigned_to integer references public.users(id) on delete set null,
  created_by integer references public.users(id) on delete set null,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  last_transaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, patient_control_number)
);

create table if not exists public.revenue_claim_lines (
  id serial primary key,
  claim_id text not null references public.revenue_claims(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  procedure_code text not null,
  description text,
  modifiers jsonb not null default '[]'::jsonb,
  diagnosis_pointers jsonb not null default '[]'::jsonb,
  place_of_service text,
  units numeric(10,3) not null default 1 check (units > 0),
  charge_amount numeric(14,2) not null default 0 check (charge_amount >= 0),
  expected_amount numeric(14,2),
  paid_amount numeric(14,2) not null default 0,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id, line_number)
);

create table if not exists public.revenue_claim_events (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text references public.revenue_claims(id) on delete cascade,
  event_type text not null,
  source text not null,
  external_event_id text,
  idempotency_key text,
  payload_hash text,
  raw_object_key text,
  summary jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_work_items (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text not null references public.revenue_claims(id) on delete cascade,
  claim_line_id integer references public.revenue_claim_lines(id) on delete cascade,
  category text not null,
  issue_code text not null,
  title text not null,
  description text not null,
  recommended_action text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'resolved', 'dismissed')),
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  priority_score integer not null default 0 check (priority_score between 0 and 100),
  recoverable_amount numeric(14,2),
  assigned_to integer references public.users(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_evidence_links (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text not null references public.revenue_claims(id) on delete cascade,
  claim_line_id integer references public.revenue_claim_lines(id) on delete cascade,
  evidence_type text not null,
  source_ref text not null,
  source_label text,
  excerpt text,
  source_location jsonb not null default '{}'::jsonb,
  rule_ref text,
  source_url text,
  effective_from text,
  effective_to text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_clearinghouse_connections (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  provider text not null default 'stedi',
  mode text not null default 'test' check (mode in ('test', 'production')),
  status text not null default 'not_configured' check (status in ('not_configured', 'credentials_pending', 'enrollment_pending', 'testing', 'certified', 'active', 'suspended')),
  credential_ref text,
  submitter_id text,
  webhook_destination_id text,
  capabilities jsonb not null default '[]'::jsonb,
  live_submission_enabled boolean not null default false,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists revenue_organization_members_user_idx on public.revenue_organization_members(user_id);
create index if not exists revenue_claims_org_status_idx on public.revenue_claims(organization_id, status);
create index if not exists revenue_claims_org_created_idx on public.revenue_claims(organization_id, created_at desc);
create index if not exists revenue_claims_external_claim_idx on public.revenue_claims(external_claim_id) where external_claim_id is not null;
create index if not exists revenue_claim_lines_procedure_idx on public.revenue_claim_lines(procedure_code);
create index if not exists revenue_claim_events_claim_occurred_idx on public.revenue_claim_events(claim_id, occurred_at desc);
create index if not exists revenue_claim_events_org_received_idx on public.revenue_claim_events(organization_id, received_at desc);
create unique index if not exists revenue_claim_events_org_source_external_idx on public.revenue_claim_events(organization_id, source, external_event_id) where external_event_id is not null;
create index if not exists revenue_work_items_org_status_priority_idx on public.revenue_work_items(organization_id, status, priority_score desc);
create index if not exists revenue_work_items_claim_status_idx on public.revenue_work_items(claim_id, status);
create index if not exists revenue_evidence_links_claim_idx on public.revenue_evidence_links(claim_id);
create index if not exists revenue_evidence_links_rule_idx on public.revenue_evidence_links(rule_ref) where rule_ref is not null;

create or replace function public.set_revenue_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'revenue_organizations',
    'revenue_organization_members',
    'revenue_claims',
    'revenue_claim_lines',
    'revenue_work_items',
    'revenue_clearinghouse_connections'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_revenue_updated_at()', table_name, table_name);
  end loop;
end;
$$;

alter table public.revenue_organizations enable row level security;
alter table public.revenue_organization_members enable row level security;
alter table public.revenue_claims enable row level security;
alter table public.revenue_claim_lines enable row level security;
alter table public.revenue_claim_events enable row level security;
alter table public.revenue_work_items enable row level security;
alter table public.revenue_evidence_links enable row level security;
alter table public.revenue_clearinghouse_connections enable row level security;

create or replace function public.revenue_has_org_role(target_organization_id text, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.revenue_organization_members m
    join public.users u on u.id = m.user_id
    where m.organization_id = target_organization_id
      and m.status = 'active'
      and m.role = any(allowed_roles)
      and u.supabase_id = auth.uid()::text
  );
$$;

revoke all on function public.revenue_has_org_role(text, text[]) from public;
grant execute on function public.revenue_has_org_role(text, text[]) to authenticated, service_role;

drop policy if exists revenue_members_select_own on public.revenue_organization_members;
create policy revenue_members_select_own on public.revenue_organization_members
for select using (
  exists (
    select 1 from public.users u
    where u.id = revenue_organization_members.user_id
      and u.supabase_id = auth.uid()::text
  ) or public.revenue_has_org_role(
    revenue_organization_members.organization_id,
    array['owner', 'admin', 'integrity_manager']::text[]
  )
);

drop policy if exists revenue_members_admin_insert on public.revenue_organization_members;
create policy revenue_members_admin_insert on public.revenue_organization_members
for insert with check (
  public.revenue_has_org_role(
    revenue_organization_members.organization_id,
    array['owner', 'admin']::text[]
  )
);

drop policy if exists revenue_members_admin_update on public.revenue_organization_members;
create policy revenue_members_admin_update on public.revenue_organization_members
for update using (
  public.revenue_has_org_role(
    revenue_organization_members.organization_id,
    array['owner', 'admin']::text[]
  )
) with check (
  public.revenue_has_org_role(
    revenue_organization_members.organization_id,
    array['owner', 'admin']::text[]
  )
);

drop policy if exists revenue_organizations_member_access on public.revenue_organizations;
create policy revenue_organizations_member_access on public.revenue_organizations
for select using (
  public.revenue_has_org_role(
    revenue_organizations.id,
    array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[]
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'revenue_claims',
    'revenue_claim_events',
    'revenue_work_items',
    'revenue_evidence_links',
    'revenue_clearinghouse_connections'
  ]
  loop
    execute format('drop policy if exists revenue_org_member_access on public.%I', table_name);
    execute format('drop policy if exists revenue_org_member_select on public.%I', table_name);
    execute format('drop policy if exists revenue_org_member_insert on public.%I', table_name);
    execute format('drop policy if exists revenue_org_member_update on public.%I', table_name);
    execute format('drop policy if exists revenue_org_admin_delete on public.%I', table_name);
    execute format(
      'create policy revenue_org_member_select on public.%I for select using (public.revenue_has_org_role(organization_id, array[''owner'', ''admin'', ''integrity_manager'', ''coder'', ''biller'', ''analyst'', ''viewer'']::text[]))',
      table_name
    );
    execute format(
      'create policy revenue_org_member_insert on public.%I for insert with check (public.revenue_has_org_role(organization_id, array[''owner'', ''admin'', ''integrity_manager'', ''coder'', ''biller'']::text[]))',
      table_name
    );
    execute format(
      'create policy revenue_org_member_update on public.%I for update using (public.revenue_has_org_role(organization_id, array[''owner'', ''admin'', ''integrity_manager'', ''coder'', ''biller'']::text[])) with check (public.revenue_has_org_role(organization_id, array[''owner'', ''admin'', ''integrity_manager'', ''coder'', ''biller'']::text[]))',
      table_name
    );
    execute format(
      'create policy revenue_org_admin_delete on public.%I for delete using (public.revenue_has_org_role(organization_id, array[''owner'', ''admin'']::text[]))',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists revenue_claim_lines_member_access on public.revenue_claim_lines;
drop policy if exists revenue_claim_lines_member_select on public.revenue_claim_lines;
create policy revenue_claim_lines_member_select on public.revenue_claim_lines
for select using (
  exists (
    select 1
    from public.revenue_claims c
    where c.id = revenue_claim_lines.claim_id
      and public.revenue_has_org_role(c.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[])
  )
);

drop policy if exists revenue_claim_lines_member_insert on public.revenue_claim_lines;
create policy revenue_claim_lines_member_insert on public.revenue_claim_lines
for insert with check (
  exists (
    select 1
    from public.revenue_claims c
    where c.id = revenue_claim_lines.claim_id
      and public.revenue_has_org_role(c.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
  )
);

drop policy if exists revenue_claim_lines_member_update on public.revenue_claim_lines;
create policy revenue_claim_lines_member_update on public.revenue_claim_lines
for update using (
  exists (
    select 1 from public.revenue_claims c
    where c.id = revenue_claim_lines.claim_id
      and public.revenue_has_org_role(c.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
  )
) with check (
  exists (
    select 1 from public.revenue_claims c
    where c.id = revenue_claim_lines.claim_id
      and public.revenue_has_org_role(c.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
  )
);

drop policy if exists revenue_claim_lines_admin_delete on public.revenue_claim_lines;
create policy revenue_claim_lines_admin_delete on public.revenue_claim_lines
for delete using (
  exists (
    select 1 from public.revenue_claims c
    where c.id = revenue_claim_lines.claim_id
      and public.revenue_has_org_role(c.organization_id, array['owner', 'admin']::text[])
  )
);

commit;

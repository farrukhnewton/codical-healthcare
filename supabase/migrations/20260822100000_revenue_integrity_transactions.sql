begin;

create table if not exists public.revenue_claim_transmissions (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text not null unique references public.revenue_claims(id) on delete cascade,
  schema_version text not null default 'stedi-837p-v3',
  transmission_data jsonb not null,
  source text not null default 'manual_verified',
  verified_by integer references public.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_claim_submissions (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text not null references public.revenue_claims(id) on delete cascade,
  provider text not null default 'stedi',
  mode text not null check (mode in ('test', 'production')),
  status text not null default 'queued' check (status in ('queued', 'submitting', 'submitted', 'failed', 'acknowledged')),
  idempotency_key text not null,
  payload_hash text not null,
  external_transaction_id text,
  correlation_id text,
  response_summary jsonb not null default '{}'::jsonb,
  last_error text,
  submitted_by integer references public.users(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, idempotency_key)
);

create table if not exists public.revenue_webhook_events (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  provider text not null default 'stedi',
  event_id text not null,
  event_type text not null,
  transaction_type text,
  transaction_id text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'processed', 'failed', 'ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error text,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (organization_id, provider, event_id)
);

create table if not exists public.revenue_remittances (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text references public.revenue_claims(id) on delete set null,
  provider text not null default 'stedi',
  transaction_id text not null,
  patient_control_number text not null,
  payer_claim_control_number text,
  claim_status_code text,
  total_charge numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  patient_responsibility_amount numeric(14,2) not null default 0,
  summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (organization_id, provider, transaction_id, patient_control_number)
);

create table if not exists public.revenue_line_remittances (
  id serial primary key,
  remittance_id integer not null references public.revenue_remittances(id) on delete cascade,
  claim_line_id integer references public.revenue_claim_lines(id) on delete set null,
  line_item_control_number text,
  procedure_code text,
  charge_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  allowed_amount numeric(14,2),
  adjustments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenue_claim_transmissions_org_idx on public.revenue_claim_transmissions(organization_id);
create index if not exists revenue_claim_submissions_claim_created_idx on public.revenue_claim_submissions(claim_id, created_at desc);
create index if not exists revenue_webhook_events_queue_idx on public.revenue_webhook_events(status, next_attempt_at);
create index if not exists revenue_remittances_claim_idx on public.revenue_remittances(claim_id);
create index if not exists revenue_line_remittances_remittance_idx on public.revenue_line_remittances(remittance_id);
create index if not exists revenue_line_remittances_claim_line_idx on public.revenue_line_remittances(claim_line_id);

drop trigger if exists set_revenue_claim_transmissions_updated_at on public.revenue_claim_transmissions;
create trigger set_revenue_claim_transmissions_updated_at before update on public.revenue_claim_transmissions
for each row execute function public.set_revenue_updated_at();

drop trigger if exists set_revenue_claim_submissions_updated_at on public.revenue_claim_submissions;
create trigger set_revenue_claim_submissions_updated_at before update on public.revenue_claim_submissions
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_claim_transmissions enable row level security;
alter table public.revenue_claim_submissions enable row level security;
alter table public.revenue_webhook_events enable row level security;
alter table public.revenue_remittances enable row level security;
alter table public.revenue_line_remittances enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'revenue_claim_transmissions',
    'revenue_claim_submissions',
    'revenue_webhook_events',
    'revenue_remittances'
  ]
  loop
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

drop policy if exists revenue_line_remittances_member_select on public.revenue_line_remittances;
create policy revenue_line_remittances_member_select on public.revenue_line_remittances
for select using (
  exists (
    select 1 from public.revenue_remittances r
    where r.id = revenue_line_remittances.remittance_id
      and public.revenue_has_org_role(r.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[])
  )
);

drop policy if exists revenue_line_remittances_member_insert on public.revenue_line_remittances;
create policy revenue_line_remittances_member_insert on public.revenue_line_remittances
for insert with check (
  exists (
    select 1 from public.revenue_remittances r
    where r.id = revenue_line_remittances.remittance_id
      and public.revenue_has_org_role(r.organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
  )
);

drop policy if exists revenue_line_remittances_admin_delete on public.revenue_line_remittances;
create policy revenue_line_remittances_admin_delete on public.revenue_line_remittances
for delete using (
  exists (
    select 1 from public.revenue_remittances r
    where r.id = revenue_line_remittances.remittance_id
      and public.revenue_has_org_role(r.organization_id, array['owner', 'admin']::text[])
  )
);

commit;

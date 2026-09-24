begin;

create table if not exists public.revenue_denial_cases (
  id text primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  claim_id text not null references public.revenue_claims(id) on delete cascade,
  remittance_id integer references public.revenue_remittances(id) on delete set null,
  created_by integer references public.users(id) on delete set null,
  scenario text not null check (scenario in ('minor_coding_error','medical_necessity','duplicate_dispute')),
  status text not null default 'evidence_needed' check (status in ('evidence_needed','evidence_added','ready','submitted','overturned','upheld','closed')),
  pathway text not null check (pathway in ('reopening','redetermination','duplicate_review')),
  payer_name text not null,
  group_code text not null,
  carc text not null,
  rarcs jsonb not null default '[]'::jsonb,
  denial_reason text not null,
  determination_date text not null,
  filing_deadline text,
  amount_at_risk numeric(14,2) not null default 0,
  required_evidence jsonb not null default '[]'::jsonb,
  evidence_notes jsonb not null default '[]'::jsonb,
  normalized_case jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_denial_events (
  id serial primary key,
  denial_case_id text not null references public.revenue_denial_cases(id) on delete cascade,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  action text not null,
  from_status text,
  to_status text not null,
  note text not null,
  created_by integer references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists revenue_denial_cases_org_status_idx on public.revenue_denial_cases(organization_id,status,filing_deadline);
create index if not exists revenue_denial_cases_claim_idx on public.revenue_denial_cases(claim_id);
create index if not exists revenue_denial_events_case_created_idx on public.revenue_denial_events(denial_case_id,created_at);

drop trigger if exists set_revenue_denial_cases_updated_at on public.revenue_denial_cases;
create trigger set_revenue_denial_cases_updated_at before update on public.revenue_denial_cases
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_denial_cases enable row level security;
alter table public.revenue_denial_events enable row level security;

drop policy if exists revenue_denial_cases_member_select on public.revenue_denial_cases;
create policy revenue_denial_cases_member_select on public.revenue_denial_cases for select using (public.revenue_has_org_role(organization_id,array['owner','admin','integrity_manager','coder','biller','analyst','viewer']::text[]));
drop policy if exists revenue_denial_cases_member_write on public.revenue_denial_cases;
create policy revenue_denial_cases_member_write on public.revenue_denial_cases for all using (public.revenue_has_org_role(organization_id,array['owner','admin','integrity_manager','coder','biller']::text[])) with check (public.revenue_has_org_role(organization_id,array['owner','admin','integrity_manager','coder','biller']::text[]));
drop policy if exists revenue_denial_events_member_select on public.revenue_denial_events;
create policy revenue_denial_events_member_select on public.revenue_denial_events for select using (public.revenue_has_org_role(organization_id,array['owner','admin','integrity_manager','coder','biller','analyst','viewer']::text[]));
drop policy if exists revenue_denial_events_member_insert on public.revenue_denial_events;
create policy revenue_denial_events_member_insert on public.revenue_denial_events for insert with check (public.revenue_has_org_role(organization_id,array['owner','admin','integrity_manager','coder','biller']::text[]));

commit;

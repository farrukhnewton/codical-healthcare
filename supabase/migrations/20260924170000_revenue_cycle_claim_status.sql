begin;

create table if not exists public.revenue_claim_status_inquiries (
  id text primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  created_by integer references public.users(id) on delete set null,
  provider text not null,
  environment text not null check (environment in ('demo', 'production')),
  data_classification text not null check (data_classification in ('synthetic', 'phi')),
  scenario text not null,
  inquiry_type text not null,
  status text not null check (status in ('received', 'processing', 'paid', 'denied', 'not_found')),
  payer_id text not null,
  payer_name text not null,
  claim_number_masked text not null,
  patient_account_masked text not null,
  claim_amount numeric(14,2),
  payment_amount numeric(14,2),
  response_id text not null,
  normalized_response jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_claim_status_org_checked_idx on public.revenue_claim_status_inquiries(organization_id, checked_at desc);
create index if not exists revenue_claim_status_org_status_idx on public.revenue_claim_status_inquiries(organization_id, status);

drop trigger if exists set_revenue_claim_status_updated_at on public.revenue_claim_status_inquiries;
create trigger set_revenue_claim_status_updated_at before update on public.revenue_claim_status_inquiries
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_claim_status_inquiries enable row level security;

drop policy if exists revenue_claim_status_member_select on public.revenue_claim_status_inquiries;
create policy revenue_claim_status_member_select on public.revenue_claim_status_inquiries for select using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[])
);
drop policy if exists revenue_claim_status_member_insert on public.revenue_claim_status_inquiries;
create policy revenue_claim_status_member_insert on public.revenue_claim_status_inquiries for insert with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_claim_status_member_update on public.revenue_claim_status_inquiries;
create policy revenue_claim_status_member_update on public.revenue_claim_status_inquiries for update using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
) with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_claim_status_admin_delete on public.revenue_claim_status_inquiries;
create policy revenue_claim_status_admin_delete on public.revenue_claim_status_inquiries for delete using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin']::text[])
);

commit;

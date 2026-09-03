begin;

create table if not exists public.revenue_connector_cursors (
  id serial primary key,
  organization_id text not null references public.revenue_organizations(id) on delete cascade,
  provider text not null,
  response_cursor text not null default '0',
  era_cursor text not null default '0',
  last_polled_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists revenue_connector_cursors_org_provider_idx
  on public.revenue_connector_cursors(organization_id, provider);

drop trigger if exists set_revenue_connector_cursors_updated_at on public.revenue_connector_cursors;
create trigger set_revenue_connector_cursors_updated_at before update on public.revenue_connector_cursors
for each row execute function public.set_revenue_updated_at();

alter table public.revenue_connector_cursors enable row level security;

drop policy if exists revenue_org_member_select on public.revenue_connector_cursors;
create policy revenue_org_member_select on public.revenue_connector_cursors for select using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller', 'analyst', 'viewer']::text[])
);
drop policy if exists revenue_org_member_insert on public.revenue_connector_cursors;
create policy revenue_org_member_insert on public.revenue_connector_cursors for insert with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_org_member_update on public.revenue_connector_cursors;
create policy revenue_org_member_update on public.revenue_connector_cursors for update using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
) with check (
  public.revenue_has_org_role(organization_id, array['owner', 'admin', 'integrity_manager', 'coder', 'biller']::text[])
);
drop policy if exists revenue_org_admin_delete on public.revenue_connector_cursors;
create policy revenue_org_admin_delete on public.revenue_connector_cursors for delete using (
  public.revenue_has_org_role(organization_id, array['owner', 'admin']::text[])
);

commit;

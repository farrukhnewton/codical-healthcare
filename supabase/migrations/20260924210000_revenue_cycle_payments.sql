alter table public.revenue_remittances
  add column if not exists payer_id text,
  add column if not exists payer_name text,
  add column if not exists payment_reference text,
  add column if not exists payment_date text,
  add column if not exists payment_method text,
  add column if not exists reconciliation_status text not null default 'unreviewed',
  add column if not exists reconciliation_variance numeric(14,2) not null default 0,
  add column if not exists reconciled_by integer references public.users(id) on delete set null,
  add column if not exists reconciled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.revenue_remittances
    add constraint revenue_remittances_reconciliation_status_check
    check (reconciliation_status in ('unreviewed', 'reviewed', 'reconciled', 'exception'));
exception when duplicate_object then null;
end $$;

create index if not exists revenue_remittances_org_reconciliation_idx
  on public.revenue_remittances (organization_id, reconciliation_status, received_at desc);

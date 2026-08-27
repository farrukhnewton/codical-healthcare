begin;

alter table public.revenue_work_items
  add column if not exists started_at timestamptz,
  add column if not exists resolved_by integer references public.users(id) on delete set null,
  add column if not exists resolution_note text;

comment on column public.revenue_work_items.resolution_note is
  'Biller-entered disposition note. Provider validation edits are resolved automatically only after a passing revalidation.';

commit;

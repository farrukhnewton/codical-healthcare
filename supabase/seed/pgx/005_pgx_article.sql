begin;

insert into public.pgx_cms_articles
  (id, article_id, title, lcd_id, version, source_url, last_synced_at, updated_at)
values
  ('a59915', 'A59915', 'Billing and Coding: Pharmacogenomic Testing', 'L39995', '26',
   'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26',
   now(), now())
on conflict (article_id) do update
set title = excluded.title,
    lcd_id = excluded.lcd_id,
    version = excluded.version,
    source_url = excluded.source_url,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

commit;

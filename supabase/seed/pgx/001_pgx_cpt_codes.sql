-- 2026 Q3 Clinical Laboratory Fee Schedule reference amounts.
-- A CLFS amount does not establish Medicare coverage or payment for a claim.
begin;

delete from public.pgx_cpt_codes;

insert into public.pgx_cpt_codes
  (id, code, description, tier, min_genes, medicare_rate, rate_year,
   rate_status, rate_source_url, article_id, source_url, updated_at)
values
  ('cpt-81418', '81418', 'Drug-metabolism genomic sequence panel, at least 6 genes', 'panel', 6, 917.08, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81225', '81225', 'CYP2C19 common-variant analysis', 'tier1', null, 291.36, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81226', '81226', 'CYP2D6 common-variant analysis', 'tier1', null, 450.91, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81227', '81227', 'CYP2C9 common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81231', '81231', 'CYP3A5 common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81232', '81232', 'DPYD common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81241', '81241', 'F5 Leiden-variant analysis', 'tier1', null, 73.37, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81247', '81247', 'G6PD common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81283', '81283', 'IFNL3 rs12979860-variant analysis', 'tier1', null, 73.37, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81306', '81306', 'NUDT15 common-variant analysis', 'tier1', null, 291.36, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81328', '81328', 'SLCO1B1 common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81335', '81335', 'TPMT common-variant analysis', 'tier1', null, 174.81, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81350', '81350', 'UGT1A1 common-variant analysis', 'tier1', null, 234.00, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81355', '81355', 'VKORC1 common-variant analysis', 'tier1', null, 88.20, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81401', '81401', 'Molecular pathology procedure, Level 2', 'tier2', null, 137.00, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81406', '81406', 'Molecular pathology procedure, Level 7', 'tier2', null, 282.88, 2026, 'published', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now()),
  ('cpt-81479', '81479', 'Unlisted molecular pathology procedure', 'unlisted', null, null, 2026, 'by_report', 'https://www.cms.gov/files/zip/26clabq3.zip', 'A59915', 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=59915&ver=26', now());

commit;

-- Image bytes now live in files; the database only stores where. Existing rows are moved to disk by
-- LegacyImageMigrator on startup, which then empties "data". The column is kept (nullable) as a safety net
-- until you have verified the migration; drop it later with:  alter table images drop column data;
alter table images add column storage_key varchar(100);
alter table images alter column data drop not null;

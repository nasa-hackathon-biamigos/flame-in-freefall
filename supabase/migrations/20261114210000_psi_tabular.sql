-- Tabular PSI warehouse (SAME detector traces, experimental tables).
-- Derived from data/raw/psi-tabular + data/raw/psi experimental_tables.
-- Rebuild with `npm run data:ingest-tabular` (SQLite local) and `--supabase`.

create table public.psi_tabular_files (
  id text primary key,
  psi_id text not null,
  file_name text not null,
  sheet_name text not null,
  kind text not null,
  material text,
  gmt text,
  run_label text,
  n_rows int not null,
  columns jsonb not null default '[]',
  source_path text not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create index psi_tabular_files_psi_idx on public.psi_tabular_files (psi_id, material);

create table public.psi_detector_samples (
  id bigserial primary key,
  file_id text not null references public.psi_tabular_files (id) on delete cascade,
  psi_id text not null,
  material text,
  t_index int not null,
  time_string text,
  elapsed_s double precision,
  iss_obscuration_v double precision,
  iss_scatter_v double precision,
  sts_v double precision,
  ion_a_v double precision,
  ion_b_v double precision,
  ptrak_pt_per_cc double precision,
  dusttrak_a_mg_m3 double precision,
  dusttrak_b_mg_m3 double precision
);
create index psi_detector_samples_file_idx on public.psi_detector_samples (file_id);
create index psi_detector_samples_psi_idx on public.psi_detector_samples (psi_id, material);

create table public.psi_table_rows (
  id bigserial primary key,
  file_id text not null references public.psi_tabular_files (id) on delete cascade,
  psi_id text not null,
  row_index int not null,
  data jsonb not null
);
create index psi_table_rows_file_idx on public.psi_table_rows (file_id);

alter table public.psi_tabular_files enable row level security;
alter table public.psi_detector_samples enable row level security;
alter table public.psi_table_rows enable row level security;

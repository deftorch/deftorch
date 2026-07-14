-- Deftorch — Fase C: skema database awal
-- Sumber: rancangan-database-deftorch.md, bagian 2 (DDL Lengkap)
-- Jalankan lewat: supabase db push  atau  psql < 0001_schema.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto"; -- untuk enkripsi kolom api key (Opsi B, lihat 0003_notes.md)

-- ============================================================
-- 1. PROFILES (extend auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. USER PREFERENCES (1:1 dengan profiles)
-- ============================================================
create table user_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  font_size text not null default 'medium' check (font_size in ('small','medium','large')),
  language text not null default 'id',
  default_model text not null default 'gemini-3.5-flash',
  default_provider text not null default 'google',
  auto_save boolean not null default true,
  show_token_count boolean not null default true,
  enable_notifications boolean not null default true,
  developer_mode boolean not null default false,
  default_system_instruction text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. API KEY CREDENTIALS
-- Opsi A dipilih sebagai default (lihat 0003_notes.md) — tabel ini
-- dibuat tapi TIDAK DIPAKAI oleh kode saat ini. BYOK tetap client-only
-- di localStorage. Dibiarkan ada untuk Opsi B di masa depan kalau
-- sinkron lintas perangkat benar-benar dibutuhkan.
-- ============================================================
create table api_key_credentials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,           -- 'google' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'ollama'
  encrypted_key text not null,      -- dienkripsi via pgcrypto, key hanya diketahui server
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ============================================================
-- 4. PROJECTS
-- ============================================================
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. AGENTS (persona) — preset (user_id null) atau custom
-- ============================================================
create table agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade, -- NULL = preset sistem
  name text not null,
  description text,
  system_instruction text not null,
  model_id text not null,
  temperature numeric(3,2) not null default 0.7 check (temperature between 0 and 2),
  use_search_grounding boolean not null default false,
  use_code_execution boolean not null default false,
  use_structured_outputs boolean not null default false,
  avatar text default '🤖',
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. COMPOSITE MODELS (router / sequential / consensus)
-- ============================================================
create table composite_models (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade, -- NULL = preset sistem
  name text not null,
  description text,
  strategy text not null check (strategy in ('sequential','routing','consensus')),
  router_model_id text,
  fallback_model_id text,
  aggregator_model_id text,
  expert_model_ids text[],
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table composite_steps (
  id uuid primary key default uuid_generate_v4(),
  composite_model_id uuid not null references composite_models(id) on delete cascade,
  step_order int not null,
  model_id text not null,
  role_instruction text,
  unique (composite_model_id, step_order)
);

create table composite_router_rules (
  id uuid primary key default uuid_generate_v4(),
  composite_model_id uuid not null references composite_models(id) on delete cascade,
  pattern text not null,
  target_model_id text not null,
  priority int not null default 0
);

-- ============================================================
-- 7. WORKFLOWS (graph node-based pipeline)
-- ============================================================
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade, -- NULL = preset sistem
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_nodes (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  node_key text not null,
  type text not null check (type in ('trigger','agent','tool','condition','output')),
  title text not null,
  config jsonb not null default '{}',
  next_node_keys text[] not null default '{}',
  position_x int,
  position_y int,
  unique (workflow_id, node_key)
);

-- ============================================================
-- 8. WORKFLOW RUNS (log eksekusi)
-- ============================================================
create table workflow_runs (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  chat_id uuid, -- FK ditambahkan lewat alter table di bawah (chats didefinisikan setelah ini)
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text
);

create table workflow_run_steps (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references workflow_runs(id) on delete cascade,
  node_key text not null,
  status text not null check (status in ('running','completed','failed','skipped')),
  output text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  latency_ms int
);

-- ============================================================
-- 9. CHATS
-- ============================================================
create table chats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  composite_model_id uuid references composite_models(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  title text not null default 'New chat',
  model_config jsonb not null default '{}',
  summary text,
  last_summarized_index int,
  is_starred boolean not null default false,
  total_tokens int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- workflow_runs.chat_id butuh chats, ditambahkan sekarang setelah chats ada
alter table workflow_runs
  add constraint workflow_runs_chat_id_fkey
  foreign key (chat_id) references chats(id) on delete set null;

-- ============================================================
-- 10. MESSAGES + VERSIONS (edit/regenerate history)
-- ============================================================
create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null default '',
  attachments jsonb default '[]',
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  agent_name text,
  agent_avatar text,
  is_edited boolean not null default false,
  parent_id uuid references messages(id) on delete set null,
  active_version_idx int default 0,
  created_at timestamptz not null default now()
);

create table message_versions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references messages(id) on delete cascade,
  version_index int not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (message_id, version_index)
);

-- ============================================================
-- 11. USAGE TRACKING
-- ============================================================
create table usage_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  chat_id uuid references chats(id) on delete set null,
  provider text not null,
  model_id text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  cost_estimate numeric(10,6) default 0,
  created_at timestamptz not null default now()
);

create table usage_daily (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  total_tokens bigint not null default 0,
  total_cost numeric(10,4) not null default 0,
  api_calls int not null default 0,
  primary key (user_id, date)
);

-- ============================================================
-- 12. MEDIA ASSETS (gambar, video, audio, dokumen — via Cloudflare R2)
-- ============================================================
create table media_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  chat_id uuid references chats(id) on delete set null,
  file_category text not null check (file_category in ('image','video','audio','document','other')),
  mime_type text not null,
  original_filename text,
  storage_provider text not null default 'r2' check (storage_provider in ('r2','supabase')),
  storage_bucket text not null,
  storage_key text not null,
  size_bytes bigint not null,
  duration_seconds numeric,
  page_count int,
  gemini_file_uri text,
  gemini_file_expires_at timestamptz,
  processing_status text not null default 'ready' check (processing_status in ('uploading','processing','ready','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_chats_user_updated on chats (user_id, updated_at desc);
create index idx_chats_project on chats (project_id);
create index idx_messages_chat_created on messages (chat_id, created_at);
create index idx_agents_user on agents (user_id);
create index idx_composite_models_user on composite_models (user_id);
create index idx_workflows_user on workflows (user_id);
create index idx_workflow_nodes_workflow on workflow_nodes (workflow_id);
create index idx_workflow_runs_workflow on workflow_runs (workflow_id);
create index idx_workflow_run_steps_run on workflow_run_steps (run_id);
create index idx_usage_logs_user_created on usage_logs (user_id, created_at desc);
create index idx_media_assets_expiry on media_assets (expires_at);
create index idx_media_assets_chat on media_assets (chat_id);
create index idx_media_assets_gemini_expiry on media_assets (gemini_file_expires_at);

-- ============================================================
-- profiles auto-provision: bikin baris `profiles` otomatis begitu
-- ada user baru di auth.users, supaya klien tidak perlu insert manual
-- (dan tidak ada race condition antara signup dan insert pertama).
-- ============================================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

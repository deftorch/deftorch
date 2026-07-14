-- Deftorch — Fase C: Row Level Security
-- Sumber: rancangan-database-deftorch.md, bagian 3.
-- Diperluas untuk tabel anak yang disebut dokumen tapi policy-nya
-- tidak dituliskan eksplisit (workflow_nodes, composite_steps,
-- composite_router_rules, workflow_runs, workflow_run_steps,
-- message_versions, usage_daily) — semuanya ikut kepemilikan induknya,
-- pola yang sama dengan "own messages via chat" di dokumen asli.

alter table profiles enable row level security;
alter table user_preferences enable row level security;
alter table api_key_credentials enable row level security;
alter table projects enable row level security;
alter table agents enable row level security;
alter table composite_models enable row level security;
alter table composite_steps enable row level security;
alter table composite_router_rules enable row level security;
alter table workflows enable row level security;
alter table workflow_nodes enable row level security;
alter table workflow_runs enable row level security;
alter table workflow_run_steps enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table message_versions enable row level security;
alter table usage_logs enable row level security;
alter table usage_daily enable row level security;
alter table media_assets enable row level security;

-- ============================================================
-- Pola umum: pemilik penuh atas datanya sendiri
-- ============================================================
create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "own preferences" on user_preferences
  for all using (auth.uid() = user_id);

-- api_key_credentials: TIDAK ada policy select untuk client di sini
-- dengan sengaja. Opsi A dipakai (lihat 0001_schema.sql) — tabel ini
-- tidak dipakai kode. Kalau nanti Opsi B diaktifkan, dekripsi/akses
-- kolom encrypted_key wajib hanya lewat service-role key di server,
-- BUKAN lewat RLS select biasa ke client.
create policy "own api key rows (metadata only via server)" on api_key_credentials
  for all using (auth.uid() = user_id);

create policy "own projects" on projects
  for all using (auth.uid() = user_id);

create policy "own chats" on chats
  for all using (auth.uid() = user_id);

create policy "own usage logs" on usage_logs
  for select using (auth.uid() = user_id);

create policy "own usage daily" on usage_daily
  for select using (auth.uid() = user_id);

-- ============================================================
-- Preset (user_id null, read-only untuk semua) + kelola milik sendiri
-- ============================================================
create policy "read presets or own agents" on agents
  for select using (user_id is null or auth.uid() = user_id);
create policy "insert own agents" on agents
  for insert with check (auth.uid() = user_id);
create policy "update own agents" on agents
  for update using (auth.uid() = user_id);
create policy "delete own agents" on agents
  for delete using (auth.uid() = user_id);

create policy "read presets or own composite models" on composite_models
  for select using (user_id is null or auth.uid() = user_id);
create policy "insert own composite models" on composite_models
  for insert with check (auth.uid() = user_id);
create policy "update own composite models" on composite_models
  for update using (auth.uid() = user_id);
create policy "delete own composite models" on composite_models
  for delete using (auth.uid() = user_id);

create policy "read presets or own workflows" on workflows
  for select using (user_id is null or auth.uid() = user_id);
create policy "insert own workflows" on workflows
  for insert with check (auth.uid() = user_id);
create policy "update own workflows" on workflows
  for update using (auth.uid() = user_id);
create policy "delete own workflows" on workflows
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Tabel anak: ikut kepemilikan induknya lewat exists()
-- ============================================================
create policy "own composite steps via parent" on composite_steps
  for all using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_steps.composite_model_id
        and (cm.user_id is null or cm.user_id = auth.uid())
    )
  );

create policy "own router rules via parent" on composite_router_rules
  for all using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_router_rules.composite_model_id
        and (cm.user_id is null or cm.user_id = auth.uid())
    )
  );

create policy "own workflow nodes via parent" on workflow_nodes
  for all using (
    exists (
      select 1 from workflows w
      where w.id = workflow_nodes.workflow_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy "own workflow runs" on workflow_runs
  for all using (auth.uid() = user_id);

create policy "own workflow run steps via parent" on workflow_run_steps
  for all using (
    exists (
      select 1 from workflow_runs wr
      where wr.id = workflow_run_steps.run_id
        and wr.user_id = auth.uid()
    )
  );

-- messages + message_versions ikut kepemilikan chats induknya
create policy "own messages via chat" on messages
  for all using (
    exists (select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid())
  );

create policy "own message versions via chat" on message_versions
  for all using (
    exists (
      select 1 from messages m
      join chats c on c.id = m.chat_id
      where m.id = message_versions.message_id and c.user_id = auth.uid()
    )
  );

-- media_assets: pemilik penuh atas file miliknya sendiri
create policy "own media assets" on media_assets
  for all using (auth.uid() = user_id);

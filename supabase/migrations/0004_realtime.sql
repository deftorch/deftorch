-- Deftorch — Fase C slice 4: Realtime
-- Supabase Realtime only broadcasts changes for tables explicitly added
-- to the `supabase_realtime` publication — RLS on the table does NOT
-- imply Realtime is on. This is easy to miss and silently leaves the
-- client subscribed to a channel that never fires.
--
-- Scope matches lib/sync/realtime.ts: chats + messages only for now.
-- Agents/composite_models/workflows stay pull-on-login (see
-- FASE_C_PROGRESS.md) — add them here too if/when their realtime
-- listeners get built.

alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table messages;

-- REPLICA IDENTITY FULL is required for DELETE/UPDATE payloads to include
-- the full old row (not just the primary key) — without this, a DELETE
-- event on the client only tells you the id, which is enough for our
-- use case (we key everything off id), but UPDATE payloads would be
-- missing unchanged columns without it in some client versions. Set it
-- explicitly rather than relying on the default.
alter table chats replica identity full;
alter table messages replica identity full;

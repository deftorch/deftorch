-- Deftorch — Fase C follow-up: close two small gaps flagged in
-- FASE_C_PROGRESS.md slice 3/4.

-- ============================================================
-- 1. composite_steps.temperature was in the local TypeScript type
-- (CompositeStep.temperature) from the start but never got a column in
-- 0001_schema.sql — so it silently reset to a 0.7 default every time a
-- composite model was pulled back down from Supabase. Adding it now
-- rather than leaving the gap in place.
-- ============================================================
alter table composite_steps add column temperature numeric(3,2) not null default 0.7 check (temperature between 0 and 2);

-- ============================================================
-- 2. Realtime: agents, composite_models (+ steps/rules), workflows
-- (+ nodes). Slice 4 only covered chats+messages; this extends the same
-- publication to the "library" tables so lib/sync/realtime.ts can add
-- listeners for them without a further migration.
-- ============================================================
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table composite_models;
alter publication supabase_realtime add table composite_steps;
alter publication supabase_realtime add table composite_router_rules;
alter publication supabase_realtime add table workflows;
alter publication supabase_realtime add table workflow_nodes;

alter table agents replica identity full;
alter table composite_models replica identity full;
alter table composite_steps replica identity full;
alter table composite_router_rules replica identity full;
alter table workflows replica identity full;
alter table workflow_nodes replica identity full;

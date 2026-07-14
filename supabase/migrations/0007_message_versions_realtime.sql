-- Deftorch — Fase C follow-up: realtime untuk message_versions
--
-- 0004_realtime.sql dan 0005_..._library_realtime.sql menambahkan chats,
-- messages, agents, composite_models, composite_steps,
-- composite_router_rules, workflows, workflow_nodes ke publication
-- `supabase_realtime`. message_versions (riwayat edit/regenerate pesan)
-- tertinggal — applyRemoteMessageUpsert() di chat-store.ts bahkan sudah
-- punya komentar eksplisit "version history arrives via message_versions,
-- not this event" tapi listener-nya sendiri belum pernah ditambahkan.
-- Tanpa ini, versi lama pesan (dari edit/regenerate) yang dibuat di tab
-- atau perangkat lain tidak akan muncul secara live di sesi ini sampai
-- reload penuh.

alter publication supabase_realtime add table message_versions;
alter table message_versions replica identity full;

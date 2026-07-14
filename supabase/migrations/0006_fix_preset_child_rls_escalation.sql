-- Deftorch — Fase C follow-up: perbaikan RLS privilege escalation
--
-- Bug: policy "own composite steps via parent" / "own router rules via
-- parent" / "own workflow nodes via parent" di 0002_rls.sql memakai
-- `for all using (parent.user_id is null or parent.user_id = auth.uid())`
-- TANPA klausa `with check` terpisah. Postgres memakai ulang `using`
-- sebagai `with check` untuk policy `for all` kalau tidak dituliskan
-- eksplisit — artinya cabang `parent.user_id is null` yang seharusnya
-- cuma untuk mengizinkan SELECT preset sistem, ikut berlaku juga untuk
-- INSERT/UPDATE/DELETE. User biasa yang login bisa menyisipkan atau
-- mengubah composite_steps/composite_router_rules/workflow_nodes yang
-- menempel ke preset sistem (parent.user_id IS NULL), merusak preset
-- yang dipakai bersama semua user.
--
-- Perbaikan: pisah jadi policy SELECT (boleh preset atau milik sendiri)
-- dan policy INSERT/UPDATE/DELETE terpisah yang HANYA mengizinkan baris
-- milik sendiri (tanpa cabang `is null`), sama seperti pola yang sudah
-- benar dipakai untuk agents/composite_models/workflows di 0002_rls.sql.

drop policy if exists "own composite steps via parent" on composite_steps;
drop policy if exists "own router rules via parent" on composite_router_rules;
drop policy if exists "own workflow nodes via parent" on workflow_nodes;

-- composite_steps
create policy "select composite steps via parent" on composite_steps
  for select using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_steps.composite_model_id
        and (cm.user_id is null or cm.user_id = auth.uid())
    )
  );

create policy "write own composite steps via parent" on composite_steps
  for insert with check (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_steps.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

create policy "update own composite steps via parent" on composite_steps
  for update using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_steps.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

create policy "delete own composite steps via parent" on composite_steps
  for delete using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_steps.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

-- composite_router_rules
create policy "select router rules via parent" on composite_router_rules
  for select using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_router_rules.composite_model_id
        and (cm.user_id is null or cm.user_id = auth.uid())
    )
  );

create policy "write own router rules via parent" on composite_router_rules
  for insert with check (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_router_rules.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

create policy "update own router rules via parent" on composite_router_rules
  for update using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_router_rules.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

create policy "delete own router rules via parent" on composite_router_rules
  for delete using (
    exists (
      select 1 from composite_models cm
      where cm.id = composite_router_rules.composite_model_id
        and cm.user_id = auth.uid()
    )
  );

-- workflow_nodes
create policy "select workflow nodes via parent" on workflow_nodes
  for select using (
    exists (
      select 1 from workflows w
      where w.id = workflow_nodes.workflow_id
        and (w.user_id is null or w.user_id = auth.uid())
    )
  );

create policy "write own workflow nodes via parent" on workflow_nodes
  for insert with check (
    exists (
      select 1 from workflows w
      where w.id = workflow_nodes.workflow_id
        and w.user_id = auth.uid()
    )
  );

create policy "update own workflow nodes via parent" on workflow_nodes
  for update using (
    exists (
      select 1 from workflows w
      where w.id = workflow_nodes.workflow_id
        and w.user_id = auth.uid()
    )
  );

create policy "delete own workflow nodes via parent" on workflow_nodes
  for delete using (
    exists (
      select 1 from workflows w
      where w.id = workflow_nodes.workflow_id
        and w.user_id = auth.uid()
    )
  );

-- Modifikasi tabel: izinkan start_date dan end_date null untuk status pending
alter table public.subscriptions alter column start_date drop not null;
alter table public.subscriptions alter column end_date drop not null;

-- Allow admins to manage all subscriptions
create policy "subs_admin_all"
  on public.subscriptions for all
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  )
  with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

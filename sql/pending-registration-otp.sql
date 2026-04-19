create extension if not exists pg_cron;

alter table public.users
add column if not exists otp text,
add column if not exists otp_created_at timestamptz;

create or replace function public.expire_otps()
returns void
language sql
security definer
as $func$
  update public.users
  set otp = 'Expired'
  where otp is not null
    and otp <> 'Expired'
    and otp_created_at is not null
    and otp_created_at <= now() - interval '60 seconds';
$func$;

do $do$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'expire-user-otp'
  ) then
    perform cron.unschedule('expire-user-otp');
  end if;

  perform cron.schedule(
    'expire-user-otp',
    '* * * * *',
    'select public.expire_otps();'
  );
end
$do$;

do $do$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'users'
  ) then
    alter table public.users enable row level security;
  end if;
end
$do$;

do $do$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_create_pending_registration'
  ) then
    drop policy public_can_create_pending_registration on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_update_pending_registration'
  ) then
    drop policy public_can_update_pending_registration on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_read_pending_registration'
  ) then
    drop policy public_can_read_pending_registration on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_delete_expired_pending_registration'
  ) then
    drop policy public_can_delete_expired_pending_registration on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_insert_otp'
  ) then
    drop policy public_can_insert_otp on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_update_otp'
  ) then
    drop policy public_can_update_otp on public.users;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'public_can_read_otp'
  ) then
    drop policy public_can_read_otp on public.users;
  end if;

  create policy public_can_insert_otp
  on public.users
  for insert
  to anon, authenticated
  with check (true);

  create policy public_can_update_otp
  on public.users
  for update
  to anon, authenticated
  using (true)
  with check (true);

  create policy public_can_read_otp
  on public.users
  for select
  to anon, authenticated
  using (true);
end
$do$;

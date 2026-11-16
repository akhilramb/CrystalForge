-- CrystalForge Auth-owned profile and per-user research data.
-- Apply in the Supabase SQL editor or with the Supabase CLI.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    display_name text,
    avatar_url text,
    institution text,
    course_or_role text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_login_at timestamptz
);

create table if not exists public.login_history (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    event_type text not null check (event_type in ('sign_in', 'sign_out', 'oauth_sign_in', 'password_reset_requested')),
    event_time timestamptz not null default now(),
    authentication_provider text not null default 'email',
    success_status boolean not null default true
);

create table if not exists public.user_preferences (
    id bigint generated always as identity primary key,
    user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
    theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
    preferred_units text not null default 'angstrom' check (preferred_units in ('angstrom', 'nanometer')),
    notification_preferences jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.saved_materials (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    material_id text not null,
    material_name text not null,
    saved_at timestamptz not null default now(),
    notes text not null default '',
    unique (user_id, material_id)
);

create table if not exists public.prediction_history (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    material_id text,
    prediction_inputs jsonb not null,
    prediction_results jsonb not null,
    model_name text not null,
    model_version text,
    created_at timestamptz not null default now(),
    kind text not null default 'prediction' check (kind in ('prediction', 'discovery'))
);

create table if not exists public.user_activity (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    activity_type text not null,
    resource_type text,
    resource_id text,
    created_at timestamptz not null default now()
);

create index if not exists login_history_user_time_idx
    on public.login_history (user_id, event_time desc);
create index if not exists prediction_history_user_time_idx
    on public.prediction_history (user_id, created_at desc);
create index if not exists user_activity_user_time_idx
    on public.user_activity (user_id, created_at desc);
create index if not exists saved_materials_user_time_idx
    on public.saved_materials (user_id, saved_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists preferences_set_updated_at on public.user_preferences;
create trigger preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Also provision profiles for accounts that existed before this migration.
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.login_history enable row level security;
alter table public.user_preferences enable row level security;
alter table public.saved_materials enable row level security;
alter table public.prediction_history enable row level security;
alter table public.user_activity enable row level security;

revoke all on public.profiles, public.login_history, public.user_preferences,
    public.saved_materials, public.prediction_history, public.user_activity
    from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert on public.login_history to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert, update, delete on public.saved_materials to authenticated;
grant select, insert, delete on public.prediction_history to authenticated;
grant select, insert on public.user_activity to authenticated;
grant usage, select on sequence public.login_history_id_seq to authenticated;
grant usage, select on sequence public.user_preferences_id_seq to authenticated;
grant usage, select on sequence public.saved_materials_id_seq to authenticated;
grant usage, select on sequence public.prediction_history_id_seq to authenticated;
grant usage, select on sequence public.user_activity_id_seq to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
for select to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
for update to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists "read own login history" on public.login_history;
create policy "read own login history" on public.login_history
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "insert own login history" on public.login_history;
create policy "insert own login history" on public.login_history
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "read own preferences" on public.user_preferences;
create policy "read own preferences" on public.user_preferences
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "insert own preferences" on public.user_preferences;
create policy "insert own preferences" on public.user_preferences
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "update own preferences" on public.user_preferences;
create policy "update own preferences" on public.user_preferences
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "read own saved materials" on public.saved_materials;
create policy "read own saved materials" on public.saved_materials
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "insert own saved materials" on public.saved_materials;
create policy "insert own saved materials" on public.saved_materials
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "update own saved materials" on public.saved_materials;
create policy "update own saved materials" on public.saved_materials
for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "delete own saved materials" on public.saved_materials;
create policy "delete own saved materials" on public.saved_materials
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "read own predictions" on public.prediction_history;
create policy "read own predictions" on public.prediction_history
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "insert own predictions" on public.prediction_history;
create policy "insert own predictions" on public.prediction_history
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "delete own predictions" on public.prediction_history;
create policy "delete own predictions" on public.prediction_history
for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "read own activity" on public.user_activity;
create policy "read own activity" on public.user_activity
for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "insert own activity" on public.user_activity;
create policy "insert own activity" on public.user_activity
for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

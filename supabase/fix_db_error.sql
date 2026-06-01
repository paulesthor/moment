-- REPAIR SCRIPT: Run this in Supabase SQL Editor to fix the 500 Error

-- 1. Ensure 'profiles' table has all necessary columns
-- If the table already existed, it might miss these columns, causing the crash.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'client';

-- 2. Re-create the trigger function to be sure it matches the columns
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'client'
  )
  on conflict (id) do update 
  set email = excluded.email,
      full_name = excluded.full_name;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Verify RLS policies exist (safe to run again)
-- This ensures the trigger can actually work and users can see profiles
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

drop policy if exists "Service role can manage all" on profiles;
-- Ideally service role bypasses RLS, but explicit policy helps in some setups

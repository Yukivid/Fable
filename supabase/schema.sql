-- Nook cloud database. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Each user can only ever see and change their own rows and files.

create table if not exists public.books (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.annotations (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  book_id    text,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.settings (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  key        text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint not null,
  synced_at  timestamptz not null default now(),
  primary key (user_id, key)
);

-- synced_at is set by the server so devices with wrong clocks still pull every change.
create or replace function public.nook_touch() returns trigger language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['books', 'annotations', 'settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before insert or update on public.%I for each row execute function public.nook_touch()', t, t);
    execute format('create index if not exists %I_sync_idx on public.%I (user_id, synced_at)', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Private bucket for EPUB files, covers and backdrop photos: <user id>/<kind>/<id>
insert into storage.buckets (id, name, public, file_size_limit)
values ('nook', 'nook', false, 104857600)
on conflict (id) do nothing;

drop policy if exists "nook own files read" on storage.objects;
drop policy if exists "nook own files insert" on storage.objects;
drop policy if exists "nook own files update" on storage.objects;
drop policy if exists "nook own files delete" on storage.objects;

create policy "nook own files read" on storage.objects for select to authenticated
  using (bucket_id = 'nook' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nook own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'nook' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nook own files update" on storage.objects for update to authenticated
  using (bucket_id = 'nook' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nook own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'nook' and (storage.foldername(name))[1] = auth.uid()::text);

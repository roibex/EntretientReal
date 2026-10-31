-- Facto : table des données + règles de sécurité.
-- À coller dans Supabase > SQL Editor > New query, puis cliquer « Run ».

-- Une ligne par compte : toutes les données de l'entreprise (clients, factures, dépenses…)
create table if not exists public.facto_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Accès à la table seulement pour les comptes connectés (aucun accès anonyme)
revoke all on public.facto_data from anon;
grant select, insert, update on public.facto_data to authenticated;

-- Sécurité : chaque compte ne peut voir et modifier QUE ses propres données
alter table public.facto_data enable row level security;

drop policy if exists "lire ses donnees" on public.facto_data;
drop policy if exists "creer ses donnees" on public.facto_data;
drop policy if exists "modifier ses donnees" on public.facto_data;

create policy "lire ses donnees" on public.facto_data
  for select to authenticated using (auth.uid() = user_id);

create policy "creer ses donnees" on public.facto_data
  for insert to authenticated with check (auth.uid() = user_id);

create policy "modifier ses donnees" on public.facto_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

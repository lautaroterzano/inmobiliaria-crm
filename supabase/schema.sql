-- Ejecutar en el SQL Editor de Supabase para crear la tabla de historial de Fiore Copilot

create table if not exists public.fiore_messages (
  id text primary key,
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiore_messages_session_created
  on public.fiore_messages (session_id, created_at asc);

alter table public.fiore_messages enable row level security;

create policy "Permitir lectura y escritura pública para Fiore Copilot"
  on public.fiore_messages
  for all
  using (true)
  with check (true);

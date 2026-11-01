-- ============================================================================
-- MINI CRM INMOBILIARIO MULTI-AGENTE (CABA) - SUPABASE SCHEMA
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.agents (
  id text primary key,
  name text not null,
  color text not null default 'emerald',
  green_id_instance text,
  green_api_token text,
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;

drop policy if exists "Acceso público a agentes CRM" on public.agents;
create policy "Acceso público a agentes CRM"
  on public.agents
  for all
  using (true)
  with check (true);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  type text not null check (type in ('seller', 'buyer')),
  stage text not null check (
    (type = 'seller' and stage in ('prospecto', 'tasacion_pendiente', 'captado', 'en_promocion', 'cerrado', 'perdido'))
    or
    (type = 'buyer' and stage in ('lead_nuevo', 'calificado', 'visita_agendada', 'en_negociacion', 'cerrado', 'descartado'))
  ),
  notes text,
  agent_id text not null default 'fiorella',
  agent_name text not null default 'Fiorella',
  last_message_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Si la tabla contacts ya existía de antes, agregar las columnas multi-agente:
alter table public.contacts add column if not exists agent_id text not null default 'fiorella';
alter table public.contacts add column if not exists agent_name text not null default 'Fiorella';

create index if not exists idx_contacts_type_stage
  on public.contacts (type, stage);

create index if not exists idx_contacts_agent_id
  on public.contacts (agent_id);

create index if not exists idx_contacts_created_at
  on public.contacts (created_at desc);

alter table public.contacts enable row level security;

drop policy if exists "Acceso público a contactos CRM de Fiorella" on public.contacts;
create policy "Acceso público a contactos CRM de Fiorella"
  on public.contacts
  for all
  using (true)
  with check (true);

-- ============================================================================
-- MINI CRM INMOBILIARIO (FIORELLA - CABA) - SUPABASE SCHEMA
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null, -- Formato internacional ej: 54911xxxxxxxx
  type text not null check (type in ('seller', 'buyer')),
  stage text not null check (
    (type = 'seller' and stage in ('prospecto', 'tasacion_pendiente', 'captado', 'en_promocion', 'cerrado', 'perdido'))
    or
    (type = 'buyer' and stage in ('lead_nuevo', 'calificado', 'visita_agendada', 'en_negociacion', 'cerrado', 'descartado'))
  ),
  notes text,
  last_message_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_type_stage
  on public.contacts (type, stage);

create index if not exists idx_contacts_created_at
  on public.contacts (created_at desc);

alter table public.contacts enable row level security;

drop policy if exists "Acceso público a contactos CRM de Fiorella" on public.contacts;

create policy "Acceso público a contactos CRM de Fiorella"
  on public.contacts
  for all
  using (true)
  with check (true);

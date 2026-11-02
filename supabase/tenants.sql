-- ============================================================================
-- MULTI-TENANT: INMOBILIARIAS (EQUIPOS) AISLADAS CON CÓDIGO DE INVITACIÓN
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (después de schema.sql y schema_crm.sql)
--
-- Qué hace:
--   1. Crea las tablas `agencies` (inmobiliarias) y `agency_members` (quién pertenece a cuál).
--   2. Agrega `agency_id` a `contacts` y `fiore_messages` (se completa SOLO desde la sesión del usuario).
--   3. Reemplaza las políticas públicas (using true) por políticas RLS que solo dejan ver/editar
--      los datos de TU inmobiliaria. Cualquiera puede loguearse con Google, pero si no tiene
--      un código de invitación válido no ve absolutamente nada de nadie.
--   4. Crea funciones RPC seguras: create_agency, join_agency, regenerate_invite_code,
--      remove_agency_member.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLAS
-- ----------------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  user_id uuid primary key references auth.users(id) on delete cascade, -- 1 usuario = 1 inmobiliaria
  agency_id uuid not null references public.agencies(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner', 'agent')),
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_agency_members_agency_id
  on public.agency_members (agency_id);

-- ----------------------------------------------------------------------------
-- 2. HELPER: inmobiliaria del usuario logueado
-- ----------------------------------------------------------------------------
create or replace function public.my_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.agency_members where user_id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS DE AGENCIES Y MEMBERS (solo lectura; las altas van por RPC)
-- ----------------------------------------------------------------------------
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;

drop policy if exists "Ver mi inmobiliaria" on public.agencies;
create policy "Ver mi inmobiliaria"
  on public.agencies
  for select
  to authenticated
  using (id = public.my_agency_id());

drop policy if exists "Ver miembros de mi inmobiliaria" on public.agency_members;
create policy "Ver miembros de mi inmobiliaria"
  on public.agency_members
  for select
  to authenticated
  using (agency_id = public.my_agency_id());

-- ----------------------------------------------------------------------------
-- 4. CONTACTS: aislar por inmobiliaria
-- ----------------------------------------------------------------------------
alter table public.contacts
  add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.contacts
  alter column agency_id set default public.my_agency_id();

create index if not exists idx_contacts_agency_id on public.contacts (agency_id);

drop policy if exists "Acceso público a contactos CRM de Fiorella" on public.contacts;
drop policy if exists "Contactos solo de mi inmobiliaria" on public.contacts;
create policy "Contactos solo de mi inmobiliaria"
  on public.contacts
  for all
  to authenticated
  using (agency_id = public.my_agency_id())
  with check (agency_id = public.my_agency_id());

-- ----------------------------------------------------------------------------
-- 5. FIORE_MESSAGES (chat, plan de marketing, plantillas, propiedades): aislar por inmobiliaria
--    La clave pasa de `id` global a (agency_id, id) para que dos inmobiliarias no choquen
--    con ids fijos como "__properties_registry_v1__".
-- ----------------------------------------------------------------------------
alter table public.fiore_messages
  add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
alter table public.fiore_messages
  alter column agency_id set default public.my_agency_id();

alter table public.fiore_messages drop constraint if exists fiore_messages_pkey;
alter table public.fiore_messages drop constraint if exists fiore_messages_agency_id_id_key;
alter table public.fiore_messages
  add constraint fiore_messages_agency_id_id_key unique (agency_id, id);

create index if not exists idx_fiore_messages_agency_session
  on public.fiore_messages (agency_id, session_id, created_at asc);

drop policy if exists "Permitir lectura y escritura pública para Fiore Copilot" on public.fiore_messages;
drop policy if exists "Mensajes solo de mi inmobiliaria" on public.fiore_messages;
create policy "Mensajes solo de mi inmobiliaria"
  on public.fiore_messages
  for all
  to authenticated
  using (agency_id = public.my_agency_id())
  with check (agency_id = public.my_agency_id());

-- ----------------------------------------------------------------------------
-- 6. TABLA LEGACY `agents` (tenía tokens con acceso público): cerrar acceso
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.agents') is not null then
    execute 'drop policy if exists "Acceso público a agentes CRM" on public.agents';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. RPCs
-- ----------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8))
$$;

-- Crear una inmobiliaria nueva (el usuario queda como owner)
create or replace function public.create_agency(p_name text, p_display_name text default null)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if exists (select 1 from public.agency_members where user_id = v_uid) then
    raise exception 'Ya pertenecés a una inmobiliaria';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Falta el nombre de la inmobiliaria';
  end if;

  insert into public.agencies (name, invite_code, created_by)
  values (trim(p_name), public.gen_invite_code(), v_uid)
  returning * into v_agency;

  insert into public.agency_members (user_id, agency_id, role, display_name, email)
  values (
    v_uid,
    v_agency.id,
    'owner',
    nullif(trim(coalesce(p_display_name, '')), ''),
    (select email from auth.users where id = v_uid)
  );

  return v_agency;
end;
$$;

-- Unirse a una inmobiliaria existente con su código de invitación
create or replace function public.join_agency(p_code text, p_display_name text default null)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if exists (select 1 from public.agency_members where user_id = v_uid) then
    raise exception 'Ya pertenecés a una inmobiliaria';
  end if;

  select * into v_agency
  from public.agencies
  where invite_code = upper(trim(coalesce(p_code, '')));

  if v_agency.id is null then
    raise exception 'Código de invitación inválido';
  end if;

  insert into public.agency_members (user_id, agency_id, role, display_name, email)
  values (
    v_uid,
    v_agency.id,
    'agent',
    nullif(trim(coalesce(p_display_name, '')), ''),
    (select email from auth.users where id = v_uid)
  );

  return v_agency;
end;
$$;

-- Generar un código nuevo (invalida el anterior). Solo owner.
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.gen_invite_code();
begin
  if not exists (
    select 1 from public.agency_members
    where user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Solo el dueño de la inmobiliaria puede regenerar el código';
  end if;

  update public.agencies set invite_code = v_code where id = public.my_agency_id();
  return v_code;
end;
$$;

-- Quitar a un miembro del equipo. Solo owner, y no a sí mismo.
create or replace function public.remove_agency_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.agency_members
    where user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Solo el dueño de la inmobiliaria puede quitar miembros';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No podés quitarte a vos mismo';
  end if;

  delete from public.agency_members
  where user_id = p_user_id and agency_id = public.my_agency_id();
end;
$$;

revoke all on function public.my_agency_id() from public, anon;
revoke all on function public.gen_invite_code() from public, anon;
revoke all on function public.create_agency(text, text) from public, anon;
revoke all on function public.join_agency(text, text) from public, anon;
revoke all on function public.regenerate_invite_code() from public, anon;
revoke all on function public.remove_agency_member(uuid) from public, anon;

grant execute on function public.my_agency_id() to authenticated;
grant execute on function public.gen_invite_code() to authenticated;
grant execute on function public.create_agency(text, text) to authenticated;
grant execute on function public.join_agency(text, text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.remove_agency_member(uuid) to authenticated;

-- ============================================================================
-- 8. MIGRAR LOS DATOS EXISTENTES (correr DESPUÉS de crear tu inmobiliaria desde la app)
--    Los contactos/mensajes viejos quedan con agency_id = NULL y NO los ve nadie
--    hasta que los asignes a tu inmobiliaria. Reemplazá TU_CODIGO por el código
--    que te muestra la app y ejecutá estas 3 líneas (la 1ra borra duplicados nuevos
--    vacíos que la app pudo haber creado antes de migrar, para que gane lo viejo):
-- ============================================================================
-- delete from public.fiore_messages where agency_id = (select id from public.agencies where invite_code = 'TU_CODIGO') and id in (select id from public.fiore_messages where agency_id is null);
-- update public.contacts       set agency_id = (select id from public.agencies where invite_code = 'TU_CODIGO') where agency_id is null;
-- update public.fiore_messages set agency_id = (select id from public.agencies where invite_code = 'TU_CODIGO') where agency_id is null;

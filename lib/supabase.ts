import { createClient } from "@supabase/supabase-js";
import type { ContactStage, ContactType } from "./whapi";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Clave única de fiore_messages en modo multi-inmobiliaria (ver supabase/tenants.sql).
 * El agency_id lo completa Postgres automáticamente con la inmobiliaria del usuario logueado.
 */
const MESSAGES_CONFLICT_KEY = "agency_id,id";

// ============================================================================
// INMOBILIARIAS (TENANTS) + CÓDIGO DE INVITACIÓN
// ============================================================================

export interface Agency {
  id: string;
  name: string;
  invite_code: string;
  created_at?: string;
}

export interface AgencyMember {
  user_id: string;
  agency_id: string;
  role: "owner" | "agent";
  display_name: string | null;
  email: string | null;
  created_at?: string;
}

function rpcErrorMessage(err: { message?: string } | null, fallback: string) {
  const msg = err?.message || fallback;
  if (msg.includes("Could not find the function") || msg.includes("does not exist")) {
    return "Falta ejecutar supabase/tenants.sql en el SQL Editor de Supabase.";
  }
  return msg;
}

/** Devuelve la inmobiliaria del usuario logueado (o null si todavía no pertenece a ninguna). */
export async function getMyAgency(
  userId: string
): Promise<{ agency: Agency | null; member: AgencyMember | null; error?: string }> {
  if (!supabase) return { agency: null, member: null };

  const { data: member, error: memberErr } = await supabase
    .from("agency_members")
    .select("user_id, agency_id, role, display_name, email, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberErr) {
    return {
      agency: null,
      member: null,
      error: rpcErrorMessage(memberErr, "No se pudo leer tu inmobiliaria"),
    };
  }
  if (!member) return { agency: null, member: null };

  const { data: agency, error: agencyErr } = await supabase
    .from("agencies")
    .select("id, name, invite_code, created_at")
    .eq("id", member.agency_id)
    .maybeSingle();

  if (agencyErr || !agency) {
    return {
      agency: null,
      member: member as AgencyMember,
      error: rpcErrorMessage(agencyErr, "No se pudo leer tu inmobiliaria"),
    };
  }

  return { agency: agency as Agency, member: member as AgencyMember };
}

export async function createAgency(
  name: string,
  displayName: string
): Promise<Agency> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("create_agency", {
    p_name: name,
    p_display_name: displayName,
  });
  if (error || !data) {
    throw new Error(rpcErrorMessage(error, "No se pudo crear la inmobiliaria"));
  }
  return data as Agency;
}

export async function joinAgency(
  code: string,
  displayName: string
): Promise<Agency> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("join_agency", {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName,
  });
  if (error || !data) {
    throw new Error(rpcErrorMessage(error, "No se pudo unir a la inmobiliaria"));
  }
  return data as Agency;
}

export async function listAgencyMembers(): Promise<AgencyMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("agency_members")
    .select("user_id, agency_id, role, display_name, email, created_at")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as AgencyMember[];
}

export async function regenerateInviteCode(): Promise<string> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("regenerate_invite_code");
  if (error || !data) {
    throw new Error(rpcErrorMessage(error, "No se pudo regenerar el código"));
  }
  return data as string;
}

export async function removeAgencyMember(userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("remove_agency_member", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(rpcErrorMessage(error, "No se pudo quitar al miembro"));
  }
}

/** Headers con el token de sesión para llamar a las rutas /api protegidas. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Borra cachés locales (contactos, planes, chats) para que no queden datos de otra cuenta en el dispositivo. */
export function clearLocalCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fiore_")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export type AgentColor = "emerald" | "violet" | "blue" | "amber" | "rose";

export interface AgentProfile {
  id: string;
  name: string;
  color: AgentColor;
  green_id_instance?: string | null;
  green_api_token?: string | null;
}

export const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: "fiorella",
    name: "Fiorella",
    color: "emerald",
  },
  {
    id: "camila",
    name: "Amiga / Socia",
    color: "violet",
  },
];

export interface StoredMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface CRMContact {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
  stage: ContactStage;
  notes?: string | null;
  agent_id: string;
  agent_name: string;
  last_message_sent_at?: string | null;
  created_at: string;
}

const LOCAL_CONTACTS_KEY = "fiore_crm_contacts_v4";
const LOCAL_AGENTS_KEY = "fiore_crm_agents_v1";
const ACTIVE_AGENT_KEY = "fiore_active_agent_id_v1";

// Etiqueta invisible en notes para persistir el dueño en Supabase incluso si no se corrió el ALTER TABLE aún
const AGENT_META_REGEX = /\n?\[\[agent:([^|]+)\|([^\]]+)\]\]$/;

function packNotesWithAgent(
  notes: string | null | undefined,
  agentId: string,
  agentName: string
): string {
  const cleanNotes = (notes || "").replace(AGENT_META_REGEX, "").trim();
  return `${cleanNotes}\n[[agent:${agentId}|${agentName}]]`.trim();
}

function unpackContactRow(row: Record<string, unknown>): CRMContact {
  const rawNotes = typeof row.notes === "string" ? row.notes : "";
  const match = rawNotes.match(AGENT_META_REGEX);

  const agentId =
    (typeof row.agent_id === "string" && row.agent_id) ||
    (match ? match[1] : "fiorella");
  const agentName =
    (typeof row.agent_name === "string" && row.agent_name) ||
    (match ? match[2] : "Fiorella");
  const cleanNotes = rawNotes.replace(AGENT_META_REGEX, "").trim() || null;

  return {
    id: String(row.id),
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    type: (row.type as ContactType) || "seller",
    stage: (row.stage as ContactStage) || "prospecto",
    notes: cleanNotes,
    agent_id: agentId,
    agent_name: agentName,
    last_message_sent_at:
      typeof row.last_message_sent_at === "string"
        ? row.last_message_sent_at
        : null,
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

const INITIAL_DEMO_CONTACTS: CRMContact[] = [];

// ============================================================================
// GESTIÓN DE PERFILES MULTI-AGENTE (SINCRONIZADO EN SUPABASE + LOCAL)
// ============================================================================

export function getSavedActiveAgentId(): string {
  if (typeof window === "undefined") return "fiorella";
  return localStorage.getItem(ACTIVE_AGENT_KEY) || "fiorella";
}

export function setSavedActiveAgentId(agentId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_AGENT_KEY, agentId);
}

export async function loadAgents(): Promise<AgentProfile[]> {
  let localList: AgentProfile[] = DEFAULT_AGENTS;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_AGENTS_KEY);
      if (raw) {
        localList = JSON.parse(raw);
      } else {
        localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(DEFAULT_AGENTS));
      }
    } catch {
      localList = DEFAULT_AGENTS;
    }
  }

  if (supabase) {
    // Usamos fiore_messages con session_id = '__agents_registry__' como almacén universal en Supabase
    // para que funcione al instante sin requerir tablas adicionales manuales
    const { data, error } = await supabase
      .from("fiore_messages")
      .select("content")
      .eq("id", "__agents_registry_v1__")
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = JSON.parse(data.content) as AgentProfile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof window !== "undefined") {
            localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch {
        // ignore
      }
    } else if (!error && !data) {
      await supabase.from("fiore_messages").upsert(
        {
          id: "__agents_registry_v1__",
          session_id: "__system_registry__",
          role: "assistant",
          content: JSON.stringify(localList),
        },
        { onConflict: MESSAGES_CONFLICT_KEY }
      );
    }
  }

  return localList;
}

export async function saveAgentsList(agents: AgentProfile[]): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(agents));
  }

  if (supabase) {
    await supabase.from("fiore_messages").upsert(
      {
        id: "__agents_registry_v1__",
        session_id: "__system_registry__",
        role: "assistant",
        content: JSON.stringify(agents),
      },
      { onConflict: MESSAGES_CONFLICT_KEY }
    );
  }
}

// ============================================================================
// HISTORIAL DE MENSAJES DEL COPILOT (SEPARADO POR AGENTE)
// ============================================================================

export async function loadMessages(sessionId: string): Promise<StoredMessage[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("fiore_messages")
      .select("id, session_id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      return data as StoredMessage[];
    }
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`fiore_chat_${sessionId}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function saveMessage(msg: StoredMessage): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      const key = `fiore_chat_${msg.session_id}`;
      const existing: StoredMessage[] = JSON.parse(
        localStorage.getItem(key) || "[]"
      );
      const exists = existing.some((m) => m.id === msg.id);
      if (!exists) {
        existing.push({
          ...msg,
          created_at: msg.created_at || new Date().toISOString(),
        });
        localStorage.setItem(key, JSON.stringify(existing));
      }
    } catch {
      // ignore
    }
  }

  if (supabase) {
    await supabase.from("fiore_messages").upsert(
      {
        id: msg.id,
        session_id: msg.session_id,
        role: msg.role,
        content: msg.content,
      },
      { onConflict: MESSAGES_CONFLICT_KEY }
    );
  }
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(`fiore_chat_${sessionId}`);
  }

  if (supabase) {
    await supabase.from("fiore_messages").delete().eq("session_id", sessionId);
  }
}

// ============================================================================
// FUNCIONES MINI CRM MULTI-AGENTE
// ============================================================================

const LEGACY_DEMO_NAMES = new Set([
  "Mart?n G?mez",
  "Luc?a Fern?ndez",
  "Santiago Pereyra",
  "Valeria y Tom?s",
]);

function isDemoContact(c: { id?: string; name?: string }): boolean {
  return Boolean(
    (c.id && LEGACY_DEMO_IDS.has(c.id)) ||
      (c.name && LEGACY_DEMO_NAMES.has(c.name.trim()))
  );
}

function purgeOldLocalStorageKeys() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("fiore_crm_contacts_v1");
    localStorage.removeItem("fiore_crm_contacts_v2");
    localStorage.removeItem("fiore_crm_contacts_v3");
    localStorage.removeItem("fiore_marketing_plan_v1_fiorella");
    localStorage.removeItem("fiore_marketing_plan_v1_camila");
  } catch {
    // ignore
  }
}

function getLocalContacts(): CRMContact[] {
  if (typeof window === "undefined") return [];
  purgeOldLocalStorageKeys();
  try {
    const raw = localStorage.getItem(LOCAL_CONTACTS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Record<string, unknown>[])
      .map(unpackContactRow)
      .filter((c) => !isDemoContact(c));
  } catch {
    return [];
  }
}

function setLocalContacts(contacts: CRMContact[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(contacts));
  } catch {
    // ignore
  }
}

const LEGACY_DEMO_IDS = new Set([
  "11111111-1111-4111-8111-111111111101",
  "11111111-1111-4111-8111-111111111102",
  "11111111-1111-4111-8111-111111111103",
  "11111111-1111-4111-8111-111111111104",
]);

export async function loadCRMContacts(): Promise<CRMContact[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      purgeOldLocalStorageKeys();
      const allRows = (data as Record<string, unknown>[]).map(unpackContactRow);
      const demoFound = allRows.filter((c) => isDemoContact(c));
      if (demoFound.length > 0) {
        await supabase
          .from("contacts")
          .delete()
          .in(
            "id",
            demoFound.map((d) => d.id)
          );
      }
      const unpacked = allRows.filter((c) => !isDemoContact(c));
      setLocalContacts(unpacked);
      return unpacked;
    }
  }

  return getLocalContacts().filter((c) => !LEGACY_DEMO_IDS.has(c.id));
}

export async function createCRMContact(input: {
  name: string;
  phone: string;
  type: ContactType;
  stage: ContactStage;
  notes?: string;
  agent_id: string;
  agent_name: string;
}): Promise<CRMContact> {
  const newContact: CRMContact = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now()
            .toString()
            .slice(-12)
            .padStart(12, "0")}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    type: input.type,
    stage: input.stage,
    notes: input.notes?.trim() || null,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    last_message_sent_at: null,
    created_at: new Date().toISOString(),
  };

  const current = getLocalContacts();
  setLocalContacts([newContact, ...current]);

  if (supabase) {
    const packedNotes = packNotesWithAgent(
      newContact.notes,
      newContact.agent_id,
      newContact.agent_name
    );

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        id: newContact.id,
        name: newContact.name,
        phone: newContact.phone,
        type: newContact.type,
        stage: newContact.stage,
        notes: packedNotes,
      })
      .select("*")
      .single();

    if (!error && data) {
      return unpackContactRow(data as Record<string, unknown>);
    }
  }

  return newContact;
}

export async function updateCRMContactStage(
  contactId: string,
  newStage: ContactStage
): Promise<void> {
  const current = getLocalContacts();
  const updated = current.map((c) =>
    c.id === contactId ? { ...c, stage: newStage } : c
  );
  setLocalContacts(updated);

  if (supabase) {
    await supabase
      .from("contacts")
      .update({ stage: newStage })
      .eq("id", contactId);
  }
}

export async function deleteCRMContact(contactId: string): Promise<void> {
  const current = getLocalContacts();
  setLocalContacts(current.filter((c) => c.id !== contactId));

  if (supabase) {
    await supabase.from("contacts").delete().eq("id", contactId);
  }
}

export async function markCRMContactMessaged(
  contactId: string
): Promise<string> {
  const nowIso = new Date().toISOString();
  const current = getLocalContacts();
  setLocalContacts(
    current.map((c) =>
      c.id === contactId ? { ...c, last_message_sent_at: nowIso } : c
    )
  );

  if (supabase) {
    await supabase
      .from("contacts")
      .update({ last_message_sent_at: nowIso })
      .eq("id", contactId);
  }

  return nowIso;
}

// ============================================================================
// PLAN DE MARKETING VIVO (SINCRONIZADO CON CRM VENDEDORES + ASISTENTE IA)
// ============================================================================

export type PlanFormat =
  | "video_primera_persona"
  | "carrusel"
  | "estados_whatsapp"
  | "historia_backstage";

export type PlanPillar =
  | "Propiedades"
  | "Educación"
  | "Backstage"
  | "WhatsApp";

export type PlanStatus = "pendiente" | "en_produccion" | "publicado";

export interface MarketingPlanItem {
  id: string;
  agent_id: string;
  title: string;
  day_time: string;
  format: PlanFormat;
  pillar: PlanPillar;
  status: PlanStatus;
  strategy_content: string;
  contact_id?: string;
  contact_name?: string;
  contact_stage?: ContactStage;
  source: "crm" | "assistant" | "ai_sync";
  updated_at: string;
}

const LOCAL_PLAN_PREFIX = "fiore_marketing_plan_v2_";

export function buildSellerPlanTemplate(
  contact: CRMContact,
  agentName = "Fiorella"
): Omit<MarketingPlanItem, "id" | "updated_at"> {
  const propDesc = contact.notes || `Propiedad de ${contact.name} en CABA`;

  switch (contact.stage) {
    case "prospecto":
    case "tasacion_pendiente":
      return {
        agent_id: contact.agent_id,
        title: `Backstage Tasación • ${contact.name}`,
        day_time: "Miércoles • 18:30 hs",
        format: "historia_backstage",
        pillar: "Backstage",
        status: "pendiente",
        contact_id: contact.id,
        contact_name: contact.name,
        contact_stage: contact.stage,
        source: "crm",
        strategy_content: `**Objetivo (Etapa: Tasación):** Generar autoridad mostrando cómo preparás una tasación real en CABA.\n\n- **Formato sugerido:** Video corto a cámara en 1ra persona + 2 Historias.\n- **Referencia propiedad:** ${propDesc}\n- **Gancho (0-3s):** *"Me pidieron tasar esta propiedad en CABA y te muestro los 3 datos reales que miro antes de ponerle precio..."*\n- **CTA:** *"Si querés saber cuánto vale hoy tu depto en CABA, escribime TASACIÓN por DM."*`,
      };
    case "captado":
      return {
        agent_id: contact.agent_id,
        title: `Pre-Lanzamiento (Próximo Ingreso) • ${contact.name}`,
        day_time: "Jueves • 19:30 hs",
        format: "video_primera_persona",
        pillar: "Propiedades",
        status: "en_produccion",
        contact_id: contact.id,
        contact_name: contact.name,
        contact_stage: contact.stage,
        source: "crm",
        strategy_content: `**Objetivo (Etapa: Captado):** Crear expectativa antes de publicar las fotos oficiales.\n\n- **Detalle propiedad:** ${propDesc}\n- **Formato:** Video en 1ra persona recorriendo el punto más fuerte + Secuencia de 3 Estados de WhatsApp.\n- **Gancho (0-3s):** *"Acaba de entrar este ingreso exclusivo y te lo muestro antes de subirlo a los portales..."*\n- **Acción clave:** Subí fotos al chat del **💬 Asistente** para definir si el lanzamiento principal va en Carrusel o Reel en 1ra persona.`,
      };
    case "en_promocion":
      return {
        agent_id: contact.agent_id,
        title: `Promoción Activa (Reel 1ra Persona + Carrusel) • ${contact.name}`,
        day_time: "Martes y Viernes • 19:00 hs",
        format: "video_primera_persona",
        pillar: "Propiedades",
        status: "en_produccion",
        contact_id: contact.id,
        contact_name: contact.name,
        contact_stage: contact.stage,
        source: "crm",
        strategy_content: `**Objetivo (Etapa: En Promoción):** Traccionar visitas calificadas para ${contact.name}.\n\n- **Propiedad:** ${propDesc}\n- **Pieza 1 (Reel en 1ra persona):** ${agentName} hablando a cámara desde la entrada hacia el ambiente más luminoso (retención 0-3s) mostrando distribución real.\n- **Pieza 2 (Carrusel de fotos):** Portada con el rincón estrella + ficha visual + llamada a agendar visita.\n- **Pieza 3 (Estados WhatsApp):** 3 estados consecutivos (Foto gancho → Video corto → Link directo a coordinar visita).`,
      };
    case "cerrado":
      return {
        agent_id: contact.agent_id,
        title: `Caso de Éxito: ¡Vendido! • ${contact.name}`,
        day_time: "Viernes • 13:00 hs",
        format: "carrusel",
        pillar: "Backstage",
        status: "pendiente",
        contact_id: contact.id,
        contact_name: contact.name,
        contact_stage: contact.stage,
        source: "crm",
        strategy_content: `**Objetivo (Etapa: Cerrado):** Prueba social para captar nuevos propietarios vendedores en la zona.\n\n- **Propiedad vendida:** ${propDesc}\n- **Formato:** Foto/Video en firma o historia contando en cuánto tiempo se reservó y cómo fue la estrategia.\n- **Copy sugerido:** *"¡Otra operación concretada en CABA! Gracias ${contact.name} por confiarme la venta de tu propiedad."*`,
      };
    default:
      return {
        agent_id: contact.agent_id,
        title: `Aprendizaje de Mercado • ${contact.name}`,
        day_time: "Lunes • 19:00 hs",
        format: "historia_backstage",
        pillar: "Educación",
        status: "publicado",
        contact_id: contact.id,
        contact_name: contact.name,
        contact_stage: contact.stage,
        source: "crm",
        strategy_content: `Propiedad marcada como **Perdida/Pausada** en el CRM (${propDesc}). Se pausan las publicaciones activas de esta propiedad.`,
      };
  }
}

function isDemoPlanItem(item: MarketingPlanItem): boolean {
  if (item.contact_id && LEGACY_DEMO_IDS.has(item.contact_id)) return true;
  if (item.contact_name && LEGACY_DEMO_NAMES.has(item.contact_name.trim()))
    return true;
  for (const demoName of LEGACY_DEMO_NAMES) {
    if (item.title?.includes(demoName)) return true;
  }
  return false;
}

export async function loadMarketingPlan(
  agentId: string
): Promise<MarketingPlanItem[]> {
  purgeOldLocalStorageKeys();
  const storageKey = `${LOCAL_PLAN_PREFIX}${agentId}`;
  const dbRowId = `__marketing_plan_${agentId}__`;

  if (supabase) {
    const { data, error } = await supabase
      .from("fiore_messages")
      .select("content")
      .eq("id", dbRowId)
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = JSON.parse(data.content) as MarketingPlanItem[];
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item) => !isDemoPlanItem(item));
          if (cleaned.length !== parsed.length) {
            await saveMarketingPlan(agentId, cleaned);
          }
          if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      } catch {
        // ignore
      }
    }
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        return (JSON.parse(cached) as MarketingPlanItem[]).filter(
          (item) => !isDemoPlanItem(item)
        );
      }
    } catch {
      // ignore
    }
  }

  return [];
}

export async function saveMarketingPlan(
  agentId: string,
  items: MarketingPlanItem[]
): Promise<void> {
  const storageKey = `${LOCAL_PLAN_PREFIX}${agentId}`;
  const dbRowId = `__marketing_plan_${agentId}__`;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  if (supabase) {
    await supabase.from("fiore_messages").upsert(
      {
        id: dbRowId,
        session_id: `__plan_${agentId}__`,
        role: "assistant",
        content: JSON.stringify(items),
      },
      { onConflict: MESSAGES_CONFLICT_KEY }
    );
  }
}

/**
 * Agrega o actualiza automáticamente en el Plan de Marketing la propiedad de un contacto Vendedor
 * cuando se lo suma desde el CRM o cuando cambia de etapa en "Vendedores".
 */
export async function syncSellerContactToMarketingPlan(
  contact: CRMContact,
  agentName = "Fiorella",
  onlyIfAlreadyInPlan = false
): Promise<{ items: MarketingPlanItem[]; updated: boolean }> {
  if (contact.type !== "seller") {
    const current = await loadMarketingPlan(contact.agent_id);
    return { items: current, updated: false };
  }

  const current = await loadMarketingPlan(contact.agent_id);
  const existingIndex = current.findIndex((i) => i.contact_id === contact.id);

  if (onlyIfAlreadyInPlan && existingIndex === -1) {
    return { items: current, updated: false };
  }

  const template = buildSellerPlanTemplate(contact, agentName);
  const nowIso = new Date().toISOString();

  let nextItems: MarketingPlanItem[];
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const updatedItem: MarketingPlanItem = {
      ...existing,
      title: template.title,
      day_time: template.day_time,
      format: template.format,
      pillar: template.pillar,
      contact_name: contact.name,
      contact_stage: contact.stage,
      strategy_content: template.strategy_content,
      updated_at: nowIso,
    };
    nextItems = current.map((item, idx) =>
      idx === existingIndex ? updatedItem : item
    );
  } else {
    const newItem: MarketingPlanItem = {
      ...template,
      id: `plan-crm-${contact.id}`,
      updated_at: nowIso,
    };
    nextItems = [newItem, ...current];
  }

  await saveMarketingPlan(contact.agent_id, nextItems);
  return { items: nextItems, updated: true };
}

/**
 * Guarda una recomendación o estrategia generada en la conversación con el Asistente directamente en el Plan de Marketing.
 */
export async function addAssistantMessageToPlan(params: {
  agentId: string;
  title: string;
  content: string;
  format?: PlanFormat;
  pillar?: PlanPillar;
  dayTime?: string;
}): Promise<MarketingPlanItem[]> {
  const current = await loadMarketingPlan(params.agentId);
  const lower = params.content.toLowerCase();

  const detectedFormat: PlanFormat =
    params.format ||
    (lower.includes("carrusel") && !lower.includes("conviene más un video")
      ? "carrusel"
      : lower.includes("estados de whatsapp") || lower.includes("secuencia")
      ? "estados_whatsapp"
      : "video_primera_persona");

  const detectedPillar: PlanPillar =
    params.pillar ||
    (lower.includes("educa") || lower.includes("tip")
      ? "Educación"
      : lower.includes("whatsapp") && !lower.includes("reel")
      ? "WhatsApp"
      : "Propiedades");

  const newItem: MarketingPlanItem = {
    id: `plan-chat-${Date.now()}`,
    agent_id: params.agentId,
    title: params.title,
    day_time: params.dayTime || "Esta semana • 19:00 hs (CABA)",
    format: detectedFormat,
    pillar: detectedPillar,
    status: "pendiente",
    strategy_content: params.content,
    source: "assistant",
    updated_at: new Date().toISOString(),
  };

  const nextItems = [newItem, ...current];
  await saveMarketingPlan(params.agentId, nextItems);
  return nextItems;
}


// ============================================================================
// PLANTILLAS DE WHATSAPP EDITABLES (SINCRONIZADAS EN SUPABASE + LOCAL)
// ============================================================================

import {
  getDefaultTemplatesList,
  type WhatsAppTemplate,
} from "./evolution";

const LOCAL_TEMPLATES_PREFIX = "fiore_whatsapp_templates_v1_";

export async function loadWhatsAppTemplates(
  agentId: string
): Promise<WhatsAppTemplate[]> {
  const storageKey = `${LOCAL_TEMPLATES_PREFIX}${agentId}`;
  const dbRowId = `__whatsapp_templates_${agentId}__`;
  const defaults = getDefaultTemplatesList();

  if (supabase) {
    const { data, error } = await supabase
      .from("fiore_messages")
      .select("content")
      .eq("id", dbRowId)
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = JSON.parse(data.content) as WhatsAppTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch {
        // ignore
      }
    }
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as WhatsAppTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } else {
        localStorage.setItem(storageKey, JSON.stringify(defaults));
      }
    } catch {
      // ignore
    }
  }

  return defaults;
}

export async function saveWhatsAppTemplates(
  agentId: string,
  templates: WhatsAppTemplate[]
): Promise<void> {
  const storageKey = `${LOCAL_TEMPLATES_PREFIX}${agentId}`;
  const dbRowId = `__whatsapp_templates_${agentId}__`;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(storageKey, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }

  if (supabase) {
    await supabase.from("fiore_messages").upsert(
      {
        id: dbRowId,
        session_id: `__templates_${agentId}__`,
        role: "assistant",
        content: JSON.stringify(templates),
      },
      { onConflict: MESSAGES_CONFLICT_KEY }
    );
  }
}

export async function resetWhatsAppTemplatesToDefault(
  agentId: string
): Promise<WhatsAppTemplate[]> {
  const defaults = getDefaultTemplatesList();
  await saveWhatsAppTemplates(agentId, defaults);
  return defaults;
}

// ============================================================================
// MÓDULO DE PROPIEDADES (SINCRONIZADO CON CRM VENDEDORES Y COMPRADORES)
// ============================================================================

export type PropertyType =
  | "Departamento"
  | "PH"
  | "Casa"
  | "Local"
  | "Oficina"
  | "Terreno"
  | "Cochera"
  | "Otro";

export const PROPERTY_TYPES: PropertyType[] = [
  "Departamento",
  "PH",
  "Casa",
  "Local",
  "Oficina",
  "Terreno",
  "Cochera",
  "Otro",
];

export interface PropertyItem {
  id: string;
  address: string;
  price: string;
  expenses: string;
  property_type: PropertyType;
  seller_contact_id: string | null;
  buyer_contact_id: string | null;
  agent_id: string;
  agent_name: string;
  created_at: string;
  updated_at: string;
}

const LOCAL_PROPERTIES_KEY = "fiore_crm_properties_v1";
const DB_PROPERTIES_ROW_ID = "__properties_registry_v1__";

function getLocalProperties(): PropertyItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PROPERTIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PropertyItem[]) : [];
  } catch {
    return [];
  }
}

function setLocalProperties(properties: PropertyItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PROPERTIES_KEY, JSON.stringify(properties));
  } catch {
    // ignore
  }
}

export async function loadProperties(): Promise<PropertyItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("fiore_messages")
      .select("content")
      .eq("id", DB_PROPERTIES_ROW_ID)
      .maybeSingle();

    if (!error && data?.content) {
      try {
        const parsed = JSON.parse(data.content) as PropertyItem[];
        if (Array.isArray(parsed)) {
          setLocalProperties(parsed);
          return parsed;
        }
      } catch {
        // ignore
      }
    }
  }

  return getLocalProperties();
}

export async function savePropertiesList(
  properties: PropertyItem[]
): Promise<void> {
  setLocalProperties(properties);

  if (supabase) {
    await supabase.from("fiore_messages").upsert(
      {
        id: DB_PROPERTIES_ROW_ID,
        session_id: "__properties_registry__",
        role: "assistant",
        content: JSON.stringify(properties),
      },
      { onConflict: MESSAGES_CONFLICT_KEY }
    );
  }
}

export async function createProperty(input: {
  address: string;
  price: string;
  expenses: string;
  property_type: PropertyType;
  seller_contact_id?: string | null;
  buyer_contact_id?: string | null;
  agent_id: string;
  agent_name: string;
}): Promise<{ property: PropertyItem; allProperties: PropertyItem[] }> {
  const nowIso = new Date().toISOString();
  const newProp: PropertyItem = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `prop-${Date.now()}`,
    address: input.address.trim(),
    price: input.price.trim(),
    expenses: input.expenses.trim(),
    property_type: input.property_type,
    seller_contact_id: input.seller_contact_id || null,
    buyer_contact_id: input.buyer_contact_id || null,
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const current = await loadProperties();
  const next = [newProp, ...current];
  await savePropertiesList(next);
  return { property: newProp, allProperties: next };
}

export async function updateProperty(
  propertyId: string,
  updates: Partial<
    Pick<
      PropertyItem,
      | "address"
      | "price"
      | "expenses"
      | "property_type"
      | "seller_contact_id"
      | "buyer_contact_id"
    >
  >
): Promise<PropertyItem[]> {
  const current = await loadProperties();
  const nowIso = new Date().toISOString();
  const next = current.map((p) =>
    p.id === propertyId
      ? {
          ...p,
          ...updates,
          updated_at: nowIso,
        }
      : p
  );
  await savePropertiesList(next);
  return next;
}

export async function deleteProperty(
  propertyId: string
): Promise<PropertyItem[]> {
  const current = await loadProperties();
  const next = current.filter((p) => p.id !== propertyId);
  await savePropertiesList(next);
  return next;
}

/**
 * Asigna o desasigna una propiedad a un contacto (Vendedor o Comprador).
 */
export async function assignPropertyToContact(params: {
  contactId: string;
  contactType: ContactType;
  propertyId: string | null;
  replaceExistingForContact?: boolean;
}): Promise<PropertyItem[]> {
  const current = await loadProperties();
  const nowIso = new Date().toISOString();
  const roleField =
    params.contactType === "seller" ? "seller_contact_id" : "buyer_contact_id";

  const next = current.map((prop) => {
    if (params.propertyId === prop.id) {
      return {
        ...prop,
        [roleField]: params.contactId,
        updated_at: nowIso,
      };
    }
    if (
      (params.propertyId === null || params.replaceExistingForContact) &&
      prop[roleField] === params.contactId
    ) {
      return {
        ...prop,
        [roleField]: null,
        updated_at: nowIso,
      };
    }
    return prop;
  });

  await savePropertiesList(next);
  return next;
}

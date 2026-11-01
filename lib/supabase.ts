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

const LOCAL_CONTACTS_KEY = "fiore_crm_contacts_v2";
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

const INITIAL_DEMO_CONTACTS: CRMContact[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Martín Gómez",
    phone: "5491145678901",
    type: "seller",
    stage: "tasacion_pendiente",
    notes:
      "Dueño directo 3 amb con balcón terraza en Caballito (Pedro Goyena). Quiere tasar esta semana.",
    agent_id: "fiorella",
    agent_name: "Fiorella",
    last_message_sent_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Lucía Fernández",
    phone: "5491156789012",
    type: "seller",
    stage: "en_promocion",
    notes:
      "PH 4 amb en Palermo Hollywood. Autorización firmada, Reel publicado en IG.",
    agent_id: "fiorella",
    agent_name: "Fiorella",
    last_message_sent_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Santiago Pereyra",
    phone: "5491167890123",
    type: "buyer",
    stage: "visita_agendada",
    notes:
      "Busca 2 amb luminoso primera vivienda en Belgrano / Núñez. Presupuesto USD 115.000 efectivo.",
    agent_id: "fiorella",
    agent_name: "Fiorella",
    last_message_sent_at: null,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Valeria y Tomás",
    phone: "5491134567890",
    type: "buyer",
    stage: "calificado",
    notes:
      "Familia buscando casa o PH 4 amb con patio en Villa Urquiza / Coghlan. Hasta USD 240.000.",
    agent_id: "camila",
    agent_name: "Amiga / Socia",
    last_message_sent_at: null,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

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
      await supabase.from("fiore_messages").upsert({
        id: "__agents_registry_v1__",
        session_id: "__system_registry__",
        role: "assistant",
        content: JSON.stringify(localList),
      });
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
      { onConflict: "id" }
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
      { onConflict: "id" }
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

function getLocalContacts(): CRMContact[] {
  if (typeof window === "undefined") return INITIAL_DEMO_CONTACTS;
  try {
    const raw = localStorage.getItem(LOCAL_CONTACTS_KEY);
    if (!raw) {
      localStorage.setItem(
        LOCAL_CONTACTS_KEY,
        JSON.stringify(INITIAL_DEMO_CONTACTS)
      );
      return INITIAL_DEMO_CONTACTS;
    }
    return (JSON.parse(raw) as Record<string, unknown>[]).map(unpackContactRow);
  } catch {
    return INITIAL_DEMO_CONTACTS;
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

export async function loadCRMContacts(): Promise<CRMContact[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      if (data.length > 0) {
        const unpacked = (data as Record<string, unknown>[]).map(
          unpackContactRow
        );
        setLocalContacts(unpacked);
        return unpacked;
      }
      // Sembrar contactos iniciales
      const rowsToInsert = INITIAL_DEMO_CONTACTS.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        type: c.type,
        stage: c.stage,
        notes: packNotesWithAgent(c.notes, c.agent_id, c.agent_name),
        last_message_sent_at: c.last_message_sent_at,
        created_at: c.created_at,
      }));
      const { data: seeded, error: seedErr } = await supabase
        .from("contacts")
        .upsert(rowsToInsert, { onConflict: "id" })
        .select("*");
      if (!seedErr && seeded) {
        const unpacked = (seeded as Record<string, unknown>[]).map(
          unpackContactRow
        );
        setLocalContacts(unpacked);
        return unpacked;
      }
    }
  }

  return getLocalContacts();
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

const LOCAL_PLAN_PREFIX = "fiore_marketing_plan_v1_";

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

export async function loadMarketingPlan(
  agentId: string
): Promise<MarketingPlanItem[]> {
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
        return JSON.parse(cached) as MarketingPlanItem[];
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
      { onConflict: "id" }
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
      { onConflict: "id" }
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

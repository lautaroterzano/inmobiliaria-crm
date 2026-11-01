"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarPlus,
  Clock,
  ExternalLink,
  MessageSquareShare,
  Phone,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStageDefinition,
  getStagesForType,
} from "@/components/crm/crm-config";
import { getAgentColorClasses } from "@/components/crm/agent-switcher-modal";
import { NewContactModal } from "@/components/crm/new-contact-modal";
import { WhatsAppPreviewModal } from "@/components/crm/whatsapp-preview-modal";
import { WhapiSettingsModal } from "@/components/crm/whapi-settings-modal";
import {
  createCRMContact,
  deleteCRMContact,
  loadCRMContacts,
  markCRMContactMessaged,
  syncSellerContactToMarketingPlan,
  updateCRMContactStage,
  type AgentProfile,
  type CRMContact,
  type MarketingPlanItem,
} from "@/lib/supabase";
import {
  normalizePhoneForWhatsApp,
  type ContactStage,
  type ContactType,
} from "@/lib/evolution";

interface CRMViewProps {
  activeAgent: AgentProfile;
  agents: AgentProfile[];
  planItems: MarketingPlanItem[];
  onPlanUpdated: (nextItems: MarketingPlanItem[]) => void;
  onGoToPlan: () => void;
}

export function CRMView({
  activeAgent,
  agents,
  planItems,
  onPlanUpdated,
  onGoToPlan,
}: CRMViewProps) {
  // Filtro: "mine" (Solo mis contactos) vs "all" (Todos los del equipo)
  const [ownerFilter, setOwnerFilter] = useState<"mine" | "all">("mine");
  const [activeFunnel, setActiveFunnel] = useState<ContactType>("seller");
  const [selectedStageFilter, setSelectedStageFilter] = useState<
    ContactStage | "all"
  >("all");
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyChangedId, setRecentlyChangedId] = useState<string | null>(
    null
  );

  // Modales
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [previewContact, setPreviewContact] = useState<CRMContact | null>(null);
  const [whapiSettingsOpen, setWhapiSettingsOpen] = useState(false);
  const [whapiConnected, setWhapiConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const list = await loadCRMContacts();
      if (mounted) {
        setContacts(list);
        setLoading(false);
      }

      try {
        const res = await fetch("/api/crm/whapi-status");
        const statusData = await res.json();
        if (mounted) setWhapiConnected(Boolean(statusData?.connected));
      } catch {
        // ignore
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFunnelSwitch = (type: ContactType) => {
    setActiveFunnel(type);
    setSelectedStageFilter("all");
  };

  const handleCreateContact = async (input: {
    name: string;
    phone: string;
    type: ContactType;
    stage: ContactStage;
    notes?: string;
  }) => {
    const created = await createCRMContact({
      ...input,
      agent_id: activeAgent.id,
      agent_name: activeAgent.name,
    });
    setContacts((prev) => [created, ...prev]);
    setActiveFunnel(created.type);
    setRecentlyChangedId(created.id);
  };

  const handleStageChange = async (
    contact: CRMContact,
    nextStage: ContactStage
  ) => {
    if (contact.stage === nextStage) return;
    const updatedContact: CRMContact = { ...contact, stage: nextStage };
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? updatedContact : c))
    );
    setRecentlyChangedId(contact.id);
    await updateCRMContactStage(contact.id, nextStage);

    // Si es un Vendedor, mantener sincronizado automáticamente el Plan de Marketing con el cambio de etapa
    if (updatedContact.type === "seller") {
      const { items, updated } = await syncSellerContactToMarketingPlan(
        updatedContact,
        activeAgent.name,
        false
      );
      if (updated) {
        onPlanUpdated(items);
      }
    }
  };

  const handleAddSellerToPlan = async (contact: CRMContact) => {
    const { items } = await syncSellerContactToMarketingPlan(
      contact,
      activeAgent.name,
      false
    );
    onPlanUpdated(items);
  };

  const handleDeleteContact = async (contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    await deleteCRMContact(contactId);
  };

  const handleSentSuccess = async (contactId: string, sentAt: string) => {
    await markCRMContactMessaged(contactId);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, last_message_sent_at: sentAt } : c
      )
    );
    if (recentlyChangedId === contactId) {
      setRecentlyChangedId(null);
    }
  };

  const myContactsCount = contacts.filter(
    (c) => c.agent_id === activeAgent.id
  ).length;
  const allContactsCount = contacts.length;

  // 1. Filtrar por dueño (Solo mis contactos vs Todos)
  const scopedContacts =
    ownerFilter === "mine"
      ? contacts.filter((c) => c.agent_id === activeAgent.id)
      : contacts;

  // 2. Filtrar por Funnel (Vendedores vs Compradores)
  const funnelContacts = scopedContacts.filter((c) => c.type === activeFunnel);

  // 3. Filtrar por Etapa
  const filteredContacts =
    selectedStageFilter === "all"
      ? funnelContacts
      : funnelContacts.filter((c) => c.stage === selectedStageFilter);

  const stages = getStagesForType(activeFunnel);

  const formatLastSent = (iso?: string | null) => {
    if (!iso) return "Sin seguimiento enviado";
    try {
      const date = new Date(iso);
      return `Últ. WhatsApp: ${date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return "WhatsApp enviado";
    }
  };

  const getAgentProfileById = (agentId: string): AgentProfile => {
    return (
      agents.find((a) => a.id === agentId) || {
        id: agentId,
        name: agentId,
        color: "amber",
      }
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* SUB-HEADER CRM: FILTRO MIS CONTACTOS vs TODOS + CONEXIÓN WHATSAPP + NUEVO */}
      <div className="px-3.5 pt-2.5 pb-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 space-y-2">
        {/* FILA 1: ESTADO WHATSAPP + BOTÓN NUEVO CONTACTO */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWhapiSettingsOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/70 text-zinc-700 dark:text-zinc-200 hover:border-emerald-500/50 transition-all"
          >
            <QrCode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              {whapiConnected ? "WhatsApp Conectado" : "Vincular WhatsApp"}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                whapiConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </button>

          <Button
            type="button"
            size="sm"
            onClick={() => setNewContactOpen(true)}
            className="h-8 rounded-xl px-3 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuevo ({activeAgent.name})</span>
          </Button>
        </div>

        {/* FILA 2: FILTRO DE PROPIETARIO ("SOLO MIS CONTACTOS" vs "TODOS DEL EQUIPO") */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90">
          <button
            type="button"
            onClick={() => setOwnerFilter("mine")}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              ownerFilter === "mine"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Mis contactos ({myContactsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setOwnerFilter("all")}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              ownerFilter === "all"
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Todos del equipo ({allContactsCount})</span>
          </button>
        </div>

        {/* FILA 3: TABS FUNNELS: VENDEDORES vs COMPRADORES */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/90">
          <button
            type="button"
            onClick={() => handleFunnelSwitch("seller")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeFunnel === "seller"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span>🏠 Vendedores</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {scopedContacts.filter((c) => c.type === "seller").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFunnelSwitch("buyer")}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeFunnel === "buyer"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span>🔍 Compradores</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {scopedContacts.filter((c) => c.type === "buyer").length}
            </span>
          </button>
        </div>

        {/* FILA 4: CHIPS DE ETAPAS DEL FUNNEL */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedStageFilter("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              selectedStageFilter === "all"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            Todas ({funnelContacts.length})
          </button>

          {stages.map((st) => {
            const count = funnelContacts.filter(
              (c) => c.stage === st.id
            ).length;
            const active = selectedStageFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStageFilter(st.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA DE CONTACTOS */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-xs text-zinc-400">
            Cargando contactos del CRM...
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              {ownerFilter === "mine"
                ? `No tenés contactos propios en esta etapa (${activeAgent.name})`
                : "No hay contactos del equipo en esta etapa"}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Tocá &ldquo;+ Nuevo ({activeAgent.name})&rdquo; arriba a la
              derecha o cambiá a &ldquo;Todos del equipo&rdquo; para ver los
              contactos de tus compañeras.
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const stageDef = getStageDefinition(contact.type, contact.stage);
            const isRecentlyUpdated = recentlyChangedId === contact.id;
            const cleanPhone = normalizePhoneForWhatsApp(contact.phone);
            const isMine = contact.agent_id === activeAgent.id;
            const ownerProfile = getAgentProfileById(contact.agent_id);
            const ownerColors = getAgentColorClasses(ownerProfile.color);

            return (
              <div
                key={contact.id}
                className={`rounded-2xl p-3.5 shadow-xs space-y-2.5 transition-all ${
                  isMine
                    ? "bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800"
                    : "bg-amber-50/35 dark:bg-amber-950/15 border-2 border-dashed border-amber-400/80 dark:border-amber-700/80"
                }`}
              >
                {/* BANNER SUPERIOR DE PROPIEDAD DEL CONTACTO (DISTINCIÓN VISUAL CLARA) */}
                <div className="flex items-center justify-between">
                  {isMine ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>Tuyo ({activeAgent.name})</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ownerColors.softBg} ${ownerColors.text} ${ownerColors.border}`}
                    >
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span>
                        Contacto de {contact.agent_name} (No es tuyo)
                      </span>
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${stageDef.badgeClass}`}
                    >
                      {stageDef.label}
                    </span>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Eliminar contacto"
                        className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Nombre y Teléfono */}
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                    {contact.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono mt-0.5">
                    <Phone className="h-3 w-3 text-emerald-600" />
                    <span>+{cleanPhone}</span>
                  </div>
                </div>

                {/* Notas */}
                {contact.notes && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2 leading-relaxed">
                    {contact.notes}
                  </p>
                )}

                {/* Selector rápido para cambiar de etapa */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatLastSent(contact.last_message_sent_at)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400">Etapa:</span>
                    <select
                      value={contact.stage}
                      onChange={(e) =>
                        handleStageChange(
                          contact,
                          e.target.value as ContactStage
                        )
                      }
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Aviso rápido al cambiar de etapa */}
                {isRecentlyUpdated && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Etapa actualizada a {stageDef.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewContact(contact)}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline"
                    >
                      Enviar WhatsApp de seguimiento →
                    </button>
                  </div>
                )}

                {/* Botones de acción de 1 clic */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={isMine ? "default" : "outline"}
                    onClick={() => setPreviewContact(contact)}
                    className={`h-8 rounded-xl text-xs font-semibold ${
                      !isMine
                        ? "border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50"
                        : ""
                    }`}
                  >
                    <MessageSquareShare className="h-3.5 w-3.5" />
                    <span>
                      {isMine
                        ? "Enviar WhatsApp"
                        : `WhatsApp (De ${contact.agent_name})`}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(`https://wa.me/${cleanPhone}`, "_blank")
                    }
                    className="h-8 rounded-xl text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir Chat</span>
                  </Button>
                </div>

                {/* Si es un contacto Vendedor: Botón para agregar/sincronizar su propiedad en el Plan de Marketing */}
                {contact.type === "seller" && (
                  <div className="pt-0.5">
                    {planItems.some((p) => p.contact_id === contact.id) ? (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          <CalendarCheck2 className="h-3.5 w-3.5" />
                          <span>En Plan de Marketing (sincronizado)</span>
                        </span>
                        <button
                          type="button"
                          onClick={onGoToPlan}
                          className="font-bold text-emerald-700 dark:text-emerald-300 underline"
                        >
                          Ver en Plan →
                        </button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSellerToPlan(contact)}
                        className="w-full h-8 rounded-xl text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span>📅 Agregar propiedad al Plan de Marketing</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODALES */}
      <NewContactModal
        open={newContactOpen}
        defaultType={activeFunnel}
        onClose={() => setNewContactOpen(false)}
        onCreate={handleCreateContact}
      />

      <WhatsAppPreviewModal
        contact={previewContact}
        activeAgent={activeAgent}
        onClose={() => setPreviewContact(null)}
        onSentSuccess={handleSentSuccess}
      />

      <WhapiSettingsModal
        open={whapiSettingsOpen}
        onStatusChange={setWhapiConnected}
        onClose={() => setWhapiSettingsOpen(false)}
      />
    </div>
  );
}

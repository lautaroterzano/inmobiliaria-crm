"use client";

import React, { useState } from "react";
import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  Copy,
  Film,
  Images,
  Loader2,
  MessageSquare,
  Sparkles,
  Trash2,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { getStageDefinition } from "@/components/crm/crm-config";
import {
  saveMarketingPlan,
  type AgentProfile,
  type CRMContact,
  type MarketingPlanItem,
  type PlanFormat,
  type PlanStatus,
} from "@/lib/supabase";

interface MarketingPlanViewProps {
  activeAgent: AgentProfile;
  planItems: MarketingPlanItem[];
  setPlanItems: React.Dispatch<React.SetStateAction<MarketingPlanItem[]>>;
  sellerContacts: CRMContact[];
  recentChatMessages: { role: string; content: string }[];
  onGoToAssistant: (prefillPrompt?: string) => void;
}

const FORMAT_LABELS: Record<
  PlanFormat,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  video_primera_persona: {
    label: "🎬 Video en 1ra Persona (a cámara)",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    icon: <Film className="h-3.5 w-3.5" />,
  },
  carrusel: {
    label: "📸 Carrusel de Fotos",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
    icon: <Images className="h-3.5 w-3.5" />,
  },
  estados_whatsapp: {
    label: "📲 Secuencia WhatsApp",
    badgeClass:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  historia_backstage: {
    label: "🤳 Historia / Backstage",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
};

export function MarketingPlanView({
  activeAgent,
  planItems,
  setPlanItems,
  sellerContacts,
  recentChatMessages,
  onGoToAssistant,
}: MarketingPlanViewProps) {
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("all");
  const [syncingAi, setSyncingAi] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, nextStatus: PlanStatus) => {
    const updated = planItems.map((item) =>
      item.id === id
        ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
        : item
    );
    setPlanItems(updated);
    await saveMarketingPlan(activeAgent.id, updated);
  };

  const handleDeleteItem = async (id: string) => {
    const updated = planItems.filter((item) => item.id !== id);
    setPlanItems(updated);
    await saveMarketingPlan(activeAgent.id, updated);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      // ignore
    }
  };

  const handleSyncWithAI = async () => {
    if (syncingAi) return;
    setSyncingAi(true);
    try {
      const res = await fetch("/api/plan/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: activeAgent.name,
          sellers: sellerContacts.map((s) => ({
            name: s.name,
            stage: s.stage,
            notes: s.notes,
          })),
          recentMessages: recentChatMessages,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.items)) {
        const nowIso = new Date().toISOString();
        const generatedItems: MarketingPlanItem[] = data.items.map(
          (
            raw: {
              title?: string;
              day_time?: string;
              format?: PlanFormat;
              pillar?: MarketingPlanItem["pillar"];
              strategy_content?: string;
            },
            idx: number
          ) => ({
            id: `plan-ai-${Date.now()}-${idx}`,
            agent_id: activeAgent.id,
            title: raw.title || "Acción sugerida por IA",
            day_time: raw.day_time || "Esta semana • 19:00 hs",
            format: raw.format || "video_primera_persona",
            pillar: raw.pillar || "Propiedades",
            status: "pendiente",
            strategy_content: raw.strategy_content || "",
            source: "ai_sync",
            updated_at: nowIso,
          })
        );

        const merged = [...generatedItems, ...planItems];
        setPlanItems(merged);
        await saveMarketingPlan(activeAgent.id, merged);
      }
    } catch (err) {
      console.error("Error sincronizando plan:", err);
    } finally {
      setSyncingAi(false);
    }
  };

  const filteredItems =
    statusFilter === "all"
      ? planItems
      : planItems.filter((i) => i.status === statusFilter);

  const pendingCount = planItems.filter((i) => i.status !== "publicado").length;
  const doneCount = planItems.filter((i) => i.status === "publicado").length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* CABECERA DEL PLAN DE MARKETING */}
      <div className="px-3.5 pt-3 pb-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
              <span>Plan de Marketing ({activeAgent.name})</span>
            </h2>
            <p className="text-[11px] text-zinc-500">
              Sincronizado con tus Vendedores del CRM y el Asistente
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={syncingAi}
            onClick={handleSyncWithAI}
            className="h-8 rounded-xl px-3 text-xs font-semibold"
          >
            {syncingAi ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Actualizar con IA</span>
              </>
            )}
          </Button>
        </div>

        {/* FILTROS DE EJECUCIÓN */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              statusFilter === "all"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            Todo ({planItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pendiente")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              statusFilter === "pendiente"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            Por grabar / hacer ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("en_produccion")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              statusFilter === "en_produccion"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            En producción (
            {planItems.filter((i) => i.status === "en_produccion").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("publicado")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              statusFilter === "publicado"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            Publicados ✅ ({doneCount})
          </button>
        </div>
      </div>

      {/* LISTA DE ACCIONES DEL PLAN */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
              <CalendarCheck2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              Tu Plan de Marketing está listo para armarse
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
              Podés sumar propiedades desde la pestaña <strong>👥 CRM</strong>,
              guardar guiones desde el <strong>💬 Asistente</strong> o tocar{" "}
              <strong>&ldquo;Actualizar con IA&rdquo;</strong> acá arriba.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const fmt =
              FORMAT_LABELS[item.format] || FORMAT_LABELS.video_primera_persona;
            const isDone = item.status === "publicado";
            const isCopied = copiedId === item.id;
            const crmStageDef = item.contact_stage
              ? getStageDefinition("seller", item.contact_stage)
              : null;

            return (
              <div
                key={item.id}
                className={`rounded-2xl p-3.5 shadow-xs space-y-2.5 border transition-all ${
                  isDone
                    ? "bg-zinc-50/80 dark:bg-zinc-900/50 border-zinc-200/60 dark:border-zinc-800/60 opacity-80"
                    : "bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800"
                }`}
              >
                {/* Fila superior: Origen + Pilar + Borrar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${fmt.badgeClass}`}
                    >
                      {fmt.label}
                    </span>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      Pilar: {item.pillar}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    title="Quitar del plan"
                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Si está vinculado a un Vendedor del CRM, mostrar conexión en vivo */}
                {item.contact_name && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/50 px-2.5 py-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                      <Home className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Vendedor CRM: {item.contact_name}</span>
                    </div>
                    {crmStageDef && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${crmStageDef.badgeClass}`}
                      >
                        {crmStageDef.label}
                      </span>
                    )}
                  </div>
                )}

                {/* Título y Día/Hora sugerido */}
                <div>
                  <h3
                    className={`text-sm font-bold leading-snug ${
                      isDone
                        ? "line-through text-zinc-500"
                        : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                    🗓️ {item.day_time}
                  </p>
                </div>

                {/* Contenido / Guion / Estrategia */}
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 p-3">
                  <MarkdownRenderer content={item.strategy_content} />
                </div>

                {/* Controles de ejecución: Estado + Copiar + Subir fotos al Asistente */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400">Estado:</span>
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(
                          item.id,
                          e.target.value as PlanStatus
                        )
                      }
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="pendiente">⏳ Por grabar / hacer</option>
                      <option value="en_produccion">🎬 En producción</option>
                      <option value="publicado">✅ Publicado</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.contact_name && (
                      <button
                        type="button"
                        onClick={() =>
                          onGoToAssistant(
                            `Te subo fotos de la propiedad de ${item.contact_name} (${item.title}). Aconsejame si conviene armar un Carrusel o un Video conmigo en primera persona mostrando la propiedad y dame el guion final.`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Evaluar fotos en Asistente</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.strategy_content)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

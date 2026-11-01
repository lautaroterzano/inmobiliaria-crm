"use client";

import React, { useRef, useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getStageDefinition,
  getStagesForType,
} from "@/components/crm/crm-config";
import {
  resetWhatsAppTemplatesToDefault,
  saveWhatsAppTemplates,
  type AgentProfile,
} from "@/lib/supabase";
import {
  renderWhatsAppTemplateBody,
  WHATSAPP_TEMPLATES,
  type ContactStage,
  type ContactType,
  type DefaultTemplateType,
  type WhatsAppTemplate,
} from "@/lib/evolution";

interface WhatsAppTemplatesViewProps {
  activeAgent: AgentProfile;
  templates: WhatsAppTemplate[];
  onTemplatesChange: (next: WhatsAppTemplate[]) => void;
}

export function WhatsAppTemplatesView({
  activeAgent,
  templates,
  onTemplatesChange,
}: WhatsAppTemplatesViewProps) {
  const [funnelFilter, setFunnelFilter] = useState<"all" | ContactType>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado del formulario de edición / creación
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState<ContactType>("seller");
  const [formStage, setFormStage] =
    useState<ContactStage>("tasacion_pendiente");
  const [formBody, setFormBody] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => {
      setSavedToast((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  const handleStartEdit = (tpl: WhatsAppTemplate) => {
    setIsCreating(false);
    setEditingId(tpl.id);
    setFormLabel(tpl.label);
    setFormType(tpl.forType);
    setFormStage(tpl.recommendedStage);
    setFormBody(tpl.body);
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    const defaultType: ContactType =
      funnelFilter === "buyer" ? "buyer" : "seller";
    setFormType(defaultType);
    setFormStage(
      defaultType === "seller" ? "tasacion_pendiente" : "calificado"
    );
    setFormLabel(
      defaultType === "seller"
        ? "Vendedor • Nueva plantilla"
        : "Comprador • Nueva plantilla"
    );
    setFormBody(
      "Hola {{name}}, ¿cómo estás? Te escribe {{agent}}. "
    );
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleTypeChangeInForm = (nextType: ContactType) => {
    setFormType(nextType);
    const stages = getStagesForType(nextType);
    if (!stages.some((s) => s.id === formStage)) {
      setFormStage(stages[0].id);
    }
  };

  const handleInsertVariable = (variable: "{{name}}" | "{{agent}}") => {
    const el = textareaRef.current;
    if (!el) {
      setFormBody((prev) => `${prev}${variable}`);
      return;
    }
    const start = el.selectionStart ?? formBody.length;
    const end = el.selectionEnd ?? formBody.length;
    const nextText =
      formBody.slice(0, start) + variable + formBody.slice(end);
    setFormBody(nextText);
    setTimeout(() => {
      el.focus();
      const cursor = start + variable.length;
      el.setSelectionRange(cursor, cursor);
    }, 20);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim() || !formBody.trim() || saving) return;

    setSaving(true);
    try {
      let nextList: WhatsAppTemplate[];

      if (isCreating) {
        const newTemplate: WhatsAppTemplate = {
          id: `custom_${formType}_${Date.now()}`,
          label: formLabel.trim(),
          forType: formType,
          recommendedStage: formStage,
          body: formBody.trim(),
          isCustom: true,
        };
        nextList = [...templates, newTemplate];
      } else if (editingId) {
        nextList = templates.map((t) =>
          t.id === editingId
            ? {
                ...t,
                label: formLabel.trim(),
                forType: formType,
                recommendedStage: formStage,
                body: formBody.trim(),
              }
            : t
        );
      } else {
        return;
      }

      onTemplatesChange(nextList);
      await saveWhatsAppTemplates(activeAgent.id, nextList);
      setEditingId(null);
      setIsCreating(false);
      showToast(
        isCreating
          ? "Nueva plantilla creada y guardada"
          : "Plantilla de WhatsApp actualizada"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreSingle = async (tplId: string) => {
    const original = WHATSAPP_TEMPLATES[tplId as DefaultTemplateType];
    if (!original) return;
    const nextList = templates.map((t) =>
      t.id === tplId ? { ...original } : t
    );
    onTemplatesChange(nextList);
    await saveWhatsAppTemplates(activeAgent.id, nextList);
    if (editingId === tplId) {
      setEditingId(null);
    }
    showToast("Plantilla restaurada al texto original");
  };

  const handleDeleteCustom = async (tplId: string) => {
    const nextList = templates.filter((t) => t.id !== tplId);
    onTemplatesChange(nextList);
    await saveWhatsAppTemplates(activeAgent.id, nextList);
    if (editingId === tplId) {
      setEditingId(null);
    }
    showToast("Plantilla personalizada eliminada");
  };

  const handleRestoreAll = async () => {
    setSaving(true);
    try {
      const defaults = await resetWhatsAppTemplatesToDefault(activeAgent.id);
      onTemplatesChange(defaults);
      setEditingId(null);
      setIsCreating(false);
      showToast("Todas las plantillas volvieron al valor original");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreview = async (tpl: WhatsAppTemplate) => {
    const rendered = renderWhatsAppTemplateBody(
      tpl.body,
      "Martín",
      activeAgent.name
    );
    try {
      await navigator.clipboard.writeText(rendered);
      setCopiedId(tpl.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === tpl.id ? null : prev));
      }, 2000);
    } catch {
      // ignore
    }
  };

  const filteredTemplates =
    funnelFilter === "all"
      ? templates
      : templates.filter((t) => t.forType === funnelFilter);

  const sellerCount = templates.filter((t) => t.forType === "seller").length;
  const buyerCount = templates.filter((t) => t.forType === "buyer").length;

  const isModifiedDefault = (tpl: WhatsAppTemplate): boolean => {
    const orig = WHATSAPP_TEMPLATES[tpl.id as DefaultTemplateType];
    if (!orig) return false;
    return (
      orig.body !== tpl.body ||
      orig.label !== tpl.label ||
      orig.recommendedStage !== tpl.recommendedStage ||
      orig.forType !== tpl.forType
    );
  };

  const renderFormCard = () => {
    const availableStages = getStagesForType(formType);
    const livePreview = renderWhatsAppTemplateBody(
      formBody || "Hola {{name}}...",
      "Martín",
      activeAgent.name
    );

    return (
      <form
        onSubmit={handleSaveForm}
        className="rounded-2xl bg-white dark:bg-zinc-900 border-2 border-emerald-500/70 dark:border-emerald-500/60 p-4 shadow-md space-y-3.5"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Edit3 className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
              {isCreating
                ? "Nueva Plantilla de WhatsApp"
                : "Editar Plantilla de WhatsApp"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancelForm}
            className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nombre de la plantilla */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Nombre de la plantilla
          </label>
          <input
            type="text"
            required
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="Ej: Vendedor • Coordinar Tasación"
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Funnel y Etapa sugerida */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Tipo de contacto
            </label>
            <select
              value={formType}
              onChange={(e) =>
                handleTypeChangeInForm(e.target.value as ContactType)
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="seller">🏠 Vendedor</option>
              <option value="buyer">🔍 Comprador</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Etapa sugerida en CRM
            </label>
            <select
              value={formStage}
              onChange={(e) => setFormStage(e.target.value as ContactStage)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              {availableStages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cuerpo del mensaje + botones de variables */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Mensaje de WhatsApp
            </label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-400 mr-0.5">
                Insertar:
              </span>
              <button
                type="button"
                onClick={() => handleInsertVariable("{{name}}")}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                + {"{{name}}"}
              </button>
              <button
                type="button"
                onClick={() => handleInsertVariable("{{agent}}")}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors"
              >
                + {"{{agent}}"}
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            rows={4}
            required
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            placeholder="Escribí el mensaje usando {{name}} para el nombre del cliente y {{agent}} para tu nombre..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed focus:border-emerald-500 focus:outline-none resize-none"
          />
        </div>

        {/* Vista previa en vivo */}
        <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Vista previa en WhatsApp (Ejemplo: Martín)
            </span>
            <span className="text-[10px] text-zinc-400">
              Firma: {activeAgent.name}
            </span>
          </div>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {livePreview}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelForm}
            className="h-8 rounded-xl text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving || !formLabel.trim() || !formBody.trim()}
            className="h-8 rounded-xl text-xs font-semibold"
          >
            <Save className="h-3.5 w-3.5" />
            <span>
              {isCreating ? "Crear plantilla" : "Guardar cambios"}
            </span>
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* SUB-HEADER DE PLANTILLAS */}
      <div className="px-3.5 pt-2.5 pb-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <MessageSquareText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Plantillas de WhatsApp</span>
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Personalizá los mensajes que enviás desde el CRM ({activeAgent.name})
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestoreAll}
              disabled={saving}
              title="Restaurar todas las plantillas por defecto"
              className="h-8 rounded-xl px-2.5 text-xs text-zinc-600 dark:text-zinc-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restaurar</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleStartCreate}
              className="h-8 rounded-xl px-3 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nueva</span>
            </Button>
          </div>
        </div>

        {/* Guía rápida de variables dinámicas */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-800 px-3 py-1.5 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-300">
            Variables automáticas:
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {"{{name}}"} = Cliente
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-700 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded">
              {"{{agent}}"} = {activeAgent.name}
            </span>
          </div>
        </div>

        {/* Filtro por Funnel */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90">
          <button
            type="button"
            onClick={() => setFunnelFilter("all")}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              funnelFilter === "all"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Todas ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setFunnelFilter("seller")}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              funnelFilter === "seller"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            🏠 Vendedores ({sellerCount})
          </button>
          <button
            type="button"
            onClick={() => setFunnelFilter("buyer")}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              funnelFilter === "buyer"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            🔍 Compradores ({buyerCount})
          </button>
        </div>
      </div>

      {/* AVISO FLOTANTE DE GUARDADO */}
      {savedToast && (
        <div className="mx-3.5 mt-2.5 flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-semibold shadow-sm">
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* LISTA DE PLANTILLAS */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
        {isCreating && renderFormCard()}

        {filteredTemplates.map((tpl) => {
          if (editingId === tpl.id) {
            return <div key={tpl.id}>{renderFormCard()}</div>;
          }

          const stageDef = getStageDefinition(
            tpl.forType,
            tpl.recommendedStage
          );
          const modified = isModifiedDefault(tpl);
          const isCopied = copiedId === tpl.id;
          const previewText = renderWhatsAppTemplateBody(
            tpl.body,
            "Martín",
            activeAgent.name
          );

          return (
            <div
              key={tpl.id}
              className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 p-3.5 shadow-xs space-y-2.5"
            >
              {/* Encabezado de tarjeta: Tipo + Etapa + Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {tpl.forType === "seller" ? "🏠 Vendedor" : "🔍 Comprador"}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${stageDef.badgeClass}`}
                  >
                    Etapa: {stageDef.label}
                  </span>
                  {tpl.isCustom && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      Personalizada
                    </span>
                  )}
                  {modified && !tpl.isCustom && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Editada
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {modified && !tpl.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleRestoreSingle(tpl.id)}
                      title="Restaurar texto original"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {tpl.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustom(tpl.id)}
                      title="Eliminar plantilla personalizada"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Título */}
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {tpl.label}
              </h3>

              {/* Plantilla con variables */}
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-800 px-3 py-2.5">
                <p className="text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  {tpl.body}
                </p>
              </div>

              {/* Vista previa renderizada */}
              <div className="rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 px-3 py-2">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                  Ejemplo enviado a &ldquo;Martín&rdquo;:
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                  &ldquo;{previewText}&rdquo;
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyPreview(tpl)}
                  className="h-8 rounded-xl text-xs"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar ejemplo</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartEdit(tpl)}
                  className="h-8 rounded-xl text-xs font-semibold"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Modificar plantilla</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  MessageSquare,
  X,
  AlertTriangle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentProfile, CRMContact } from "@/lib/supabase";
import {
  getDefaultTemplateForStage,
  getDefaultTemplatesList,
  normalizePhoneForWhatsApp,
  renderWhatsAppTemplate,
  type TemplateType,
  type WhatsAppTemplate,
} from "@/lib/evolution";

interface WhatsAppPreviewModalProps {
  contact: CRMContact | null;
  activeAgent: AgentProfile;
  templates?: WhatsAppTemplate[];
  onEditTemplates?: () => void;
  onClose: () => void;
  onSentSuccess: (contactId: string, sentAt: string) => void;
}

export function WhatsAppPreviewModal({
  contact,
  activeAgent,
  templates,
  onEditTemplates,
  onClose,
  onSentSuccess,
}: WhatsAppPreviewModalProps) {
  const activeTemplates =
    templates && templates.length > 0 ? templates : getDefaultTemplatesList();

  const [templateType, setTemplateType] =
    useState<TemplateType>("seller_tasacion");
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    if (contact) {
      const defaultTpl = getDefaultTemplateForStage(
        contact.type,
        contact.stage,
        activeTemplates
      );
      setTemplateType(defaultTpl);
      setMessageText(
        renderWhatsAppTemplate(
          defaultTpl,
          contact.name,
          activeAgent.name,
          activeTemplates
        )
      );
    }
  }, [contact, activeAgent.name, activeTemplates]);

  if (!contact) return null;

  const isForeignContact = contact.agent_id !== activeAgent.id;

  const handleTemplateSelect = (nextTpl: TemplateType) => {
    setTemplateType(nextTpl);
    setMessageText(
      renderWhatsAppTemplate(
        nextTpl,
        contact.name,
        activeAgent.name,
        activeTemplates
      )
    );
  };

  const handleOpenWaMe = () => {
    const cleanPhone = normalizePhoneForWhatsApp(contact.phone);
    const encoded = encodeURIComponent(messageText.trim());
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
    onSentSuccess(contact.id, new Date().toISOString());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Enviar WhatsApp a {contact.name}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500">
                +{normalizePhoneForWhatsApp(contact.phone)} • Remitente:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {activeAgent.name}
                </strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isForeignContact && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Atención:</strong> Este contacto fue cargado por{" "}
              <strong>{contact.agent_name}</strong>. Al enviar, saldrá desde tu
              propio WhatsApp ({activeAgent.name}).
            </span>
          </div>
        )}

        <div className="mt-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Plantilla sugerida
              </label>
              {onEditTemplates && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditTemplates();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <Settings2 className="h-3 w-3" />
                  <span>Modificar plantillas</span>
                </button>
              )}
            </div>
            <select
              value={templateType}
              onChange={(e) =>
                handleTemplateSelect(e.target.value as TemplateType)
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              {activeTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Mensaje personalizado
              </label>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Podés editar antes de abrir
              </span>
            </div>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-1">
            <Button
              type="button"
              onClick={handleOpenWaMe}
              disabled={!messageText.trim()}
              className="w-full h-11 rounded-xl font-semibold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir en mi WhatsApp personal</span>
            </Button>
            <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 mt-2">
              Se abrirá tu WhatsApp con el mensaje listo para enviar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

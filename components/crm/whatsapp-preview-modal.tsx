"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  X,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentProfile, CRMContact } from "@/lib/supabase";
import {
  getDefaultTemplateForStage,
  normalizePhoneForWhatsApp,
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
  type TemplateType,
} from "@/lib/evolution";

interface WhatsAppPreviewModalProps {
  contact: CRMContact | null;
  activeAgent: AgentProfile;
  onClose: () => void;
  onSentSuccess: (contactId: string, sentAt: string) => void;
}

export function WhatsAppPreviewModal({
  contact,
  activeAgent,
  onClose,
  onSentSuccess,
}: WhatsAppPreviewModalProps) {
  const [templateType, setTemplateType] =
    useState<TemplateType>("seller_tasacion");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  useEffect(() => {
    if (contact) {
      const defaultTpl = getDefaultTemplateForStage(
        contact.type,
        contact.stage
      );
      setTemplateType(defaultTpl);
      setMessageText(
        renderWhatsAppTemplate(defaultTpl, contact.name, activeAgent.name)
      );
      setErrorMsg(null);
      setSentOk(false);
    }
  }, [contact, activeAgent.name]);

  if (!contact) return null;

  const isForeignContact = contact.agent_id !== activeAgent.id;

  const handleTemplateSelect = (nextTpl: TemplateType) => {
    setTemplateType(nextTpl);
    setMessageText(
      renderWhatsAppTemplate(nextTpl, contact.name, activeAgent.name)
    );
    setErrorMsg(null);
  };

  const handleSendDirect = async () => {
    if (!messageText.trim() || sending) return;
    setSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/crm/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          templateType,
          customMessage: messageText.trim(),
          phone: contact.phone,
          name: contact.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.error ||
            "No se pudo enviar automáticamente. Probá con 'Abrir chat en WhatsApp App'."
        );
        return;
      }

      setSentOk(true);
      onSentSuccess(contact.id, data.sentAt || new Date().toISOString());
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error de red al enviar WhatsApp"
      );
    } finally {
      setSending(false);
    }
  };

  const handleOpenWaMe = () => {
    const cleanPhone = normalizePhoneForWhatsApp(contact.phone);
    const encoded = encodeURIComponent(messageText.trim());
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
    onSentSuccess(contact.id, new Date().toISOString());
    onClose();
  };

  const templatesList = Object.values(WHATSAPP_TEMPLATES);

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
                +{normalizePhoneForWhatsApp(contact.phone)} • Firma:{" "}
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

        {/* ALERTA VISUAL SI EL CONTACTO PERTENECE A OTRA AGENTE */}
        {isForeignContact && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="font-bold block">
                ¡Ojo! Este contacto es de {contact.agent_name}
              </strong>
              <span>
                Estás por escribirle desde tu perfil ({activeAgent.name}) a un
                contacto asignado a {contact.agent_name}.
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Plantilla sugerida ({activeAgent.name} • CABA)
            </label>
            <select
              value={templateType}
              onChange={(e) =>
                handleTemplateSelect(e.target.value as TemplateType)
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              {templatesList.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Vista previa editable antes de disparar
              </label>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Podés editar el texto
              </span>
            </div>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {sentOk && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>¡WhatsApp enviado directamente desde el CRM!</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              onClick={handleSendDirect}
              disabled={sending || sentOk || !messageText.trim()}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando WhatsApp...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Enviar WhatsApp directo (sin abrir la App)</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenWaMe}
              disabled={!messageText.trim()}
              className="w-full h-9 rounded-xl text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir chat en WhatsApp App (wa.me)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

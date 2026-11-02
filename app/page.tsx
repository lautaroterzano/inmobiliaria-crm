"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  SendHorizontal,
  Sparkles,
  Trash2,
  Loader2,
  Bot,
  User,
  MessageSquareText,
  Users,
  LogOut,
  ImagePlus,
  CalendarCheck2,
  CalendarPlus,
  FileEdit,
  Building2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { CRMView } from "@/components/crm/crm-view";
import { PropertiesView } from "@/components/properties/properties-view";
import { MarketingPlanView } from "@/components/plan/marketing-plan-view";
import { WhatsAppTemplatesView } from "@/components/templates/whatsapp-templates-view";
import { AuthScreen } from "@/components/auth-screen";
import {
  addAssistantMessageToPlan,
  clearSessionMessages,
  loadCRMContacts,
  loadMarketingPlan,
  loadMessages,
  loadProperties,
  loadWhatsAppTemplates,
  saveMessage,
  supabase,
  syncSellerContactToMarketingPlan,
  type AgentProfile,
  type CRMContact,
  type MarketingPlanItem,
  type PropertyItem,
} from "@/lib/supabase";
import {
  getDefaultTemplatesList,
  type WhatsAppTemplate,
} from "@/lib/evolution";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

type MainSection = "copilot" | "plan" | "properties" | "crm" | "templates";

interface QuickAction {
  emoji: string;
  label: string;
  prompt: string;
  prefillOnly?: boolean;
  triggerPhotoPicker?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    emoji: "📸",
    label: "Subir fotos de propiedad",
    prompt:
      "Te subo fotos de esta propiedad en CABA. Analizalas y aconsejame si conviene armar un Carrusel o un Video conmigo en primera persona mostrando la propiedad, y armame el guion/estructura.",
    prefillOnly: true,
    triggerPhotoPicker: true,
  },
  {
    emoji: "📋",
    label: "Plan semanal",
    prompt:
      "Armame el plan semanal de contenidos para esta semana en CABA (Instagram, TikTok y Estados de WhatsApp) teniendo en cuenta mis propiedades en el CRM, con día, horario ideal, formato y pilar.",
  },
  {
    emoji: "🏠",
    label: "Nueva propiedad",
    prompt:
      "Entró nueva propiedad en [Barrio, ej: Palermo / Caballito]: [Cant. ambientes], [balcón/patio/luz/amenities], valor USD [Precio]. Armame Guion de Reel con gancho 0-3s, Copy con hashtags porteños y Secuencia de 3 Estados de WhatsApp.",
    prefillOnly: true,
  },
  {
    emoji: "💡",
    label: "Idea de Reel a cámara",
    prompt:
      "Dame una idea de Reel hablando directo a cámara (fresco, al hueso y sin clichés inmobiliarios) para captar compradores de primera vivienda o familias en CABA, con gancho de los primeros 3 segundos y estructura paso a paso.",
  },
  {
    emoji: "📲",
    label: "Secuencia WhatsApp",
    prompt:
      "Armame una secuencia de 3 Estados de WhatsApp estratégicos para hoy que generen respuestas por privado (DM) de contactos interesados en comprar o vender en CABA.",
  },
];

function buildAgentFromSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): AgentProfile {
  const rawName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" &&
      user.user_metadata.name) ||
    (user.email ? user.email.split("@")[0] : "Agente");

  const firstName = rawName.trim().split(" ")[0] || "Agente";
  const isFiorella = firstName.toLowerCase().startsWith("fiore");

  return {
    id: isFiorella ? "fiorella" : user.id,
    name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
    color: isFiorella ? "emerald" : "violet",
  };
}

/**
 * Redimensiona y comprime una imagen en el navegador a JPEG <= 960px para que suba rápido desde el celular.
 */
function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FioreCopilotPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [activeAgent, setActiveAgent] = useState<AgentProfile | null>(null);
  const [activeSection, setActiveSection] = useState<MainSection>("copilot");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedToPlanId, setSavedToPlanId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Estado compartido de Plan de Marketing, Vendedores CRM y Plantillas de WhatsApp
  const [planItems, setPlanItems] = useState<MarketingPlanItem[]>([]);
  const [allContacts, setAllContacts] = useState<CRMContact[]>([]);
  const [sellerContacts, setSellerContacts] = useState<CRMContact[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<
    WhatsAppTemplate[]
  >(() => getDefaultTemplatesList());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar sesión de Supabase Auth (Google OAuth / Email)
  useEffect(() => {
    if (!supabase) {
      setActiveAgent({ id: "fiorella", name: "Fiorella", color: "emerald" });
      setAuthChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setActiveAgent(buildAgentFromSupabaseUser(session.user));
      } else {
        setActiveAgent(null);
      }
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setActiveAgent(buildAgentFromSupabaseUser(session.user));
      } else {
        setActiveAgent(null);
      }
      setAuthChecking(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const sessionId = activeAgent
    ? `fiorella-caba-${activeAgent.id}`
    : "fiorella-caba-anon";

  // Cargar historial de chat, contactos vendedores, Plan de Marketing y Plantillas de WhatsApp
  useEffect(() => {
    if (!activeAgent) return;
    let mounted = true;
    setHistoryLoaded(false);
    async function initAgentData() {
      const [savedMsgs, loadedContacts, currentPlan, savedTemplates, loadedProperties] =
        await Promise.all([
          loadMessages(sessionId),
          loadCRMContacts(),
          loadMarketingPlan(activeAgent!.id),
          loadWhatsAppTemplates(activeAgent!.id),
          loadProperties(),
        ]);

      if (!mounted) return;

      setMessages(
        savedMsgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );

      setAllContacts(loadedContacts);
      setProperties(loadedProperties);
      setWhatsappTemplates(savedTemplates);

      const mySellers = loadedContacts.filter(
        (c) => c.type === "seller" && c.agent_id === activeAgent!.id
      );
      setSellerContacts(mySellers);

      // Si el plan está vacío pero hay vendedores propios, poblar inicialmente con esos vendedores
      if (currentPlan.length === 0 && mySellers.length > 0) {
        let updatedPlan = currentPlan;
        for (const seller of mySellers) {
          const res = await syncSellerContactToMarketingPlan(
            seller,
            activeAgent!.name,
            false
          );
          updatedPlan = res.items;
        }
        if (mounted) setPlanItems(updatedPlan);
      } else {
        setPlanItems(currentPlan);
      }

      setHistoryLoaded(true);
    }
    initAgentData();
    return () => {
      mounted = false;
    };
  }, [sessionId, activeAgent]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setActiveAgent(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const compressed: string[] = [];
    for (const file of files.slice(0, 4)) {
      try {
        const dataUrl = await compressImageToDataUrl(file);
        compressed.push(dataUrl);
      } catch {
        // ignore invalid file
      }
    }

    setAttachedImages((prev) => [...prev, ...compressed].slice(0, 4));
    if (!input.trim()) {
      setInput(
        "Te subo fotos de esta propiedad. Aconsejame si conviene armar un Carrusel o un Video conmigo en primera persona mostrando la propiedad, y armame el guion/estructura."
      );
    }
    e.target.value = "";
  };

  const handleRemoveAttachedImage = (idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAssistantMessageToPlan = useCallback(
    async (msgId: string, content: string, titleHint?: string) => {
      if (!activeAgent || !content.trim()) return;
      const firstLine =
        titleHint ||
        content
          .split("\n")
          .find((l) => l.trim().length > 4)
          ?.replace(/^[#*-\s]+/, "")
          .slice(0, 68) ||
        "Estrategia del Asistente";

      const nextPlan = await addAssistantMessageToPlan({
        agentId: activeAgent.id,
        title: firstLine,
        content,
      });
      setPlanItems(nextPlan);
      setSavedToPlanId(msgId);
      setTimeout(() => {
        setSavedToPlanId((prev) => (prev === msgId ? null : prev));
      }, 2500);
    },
    [activeAgent]
  );

  const sendMessageAndStream = useCallback(
    async (
      userText: string,
      currentMessages: ChatMessage[],
      imagesToSend?: string[]
    ) => {
      if (!activeAgent) return;
      const userMsgId = `user-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: userText,
        images:
          imagesToSend && imagesToSend.length > 0 ? imagesToSend : undefined,
      };

      const nextMessages = [...currentMessages, userMsg];
      setMessages(nextMessages);
      setIsLoading(true);

      await saveMessage({
        id: userMsgId,
        session_id: sessionId,
        role: "user",
        content: userText,
      });

      const sellerContext =
        sellerContacts.length > 0
          ? sellerContacts
              .map(
                (s) =>
                  `- ${s.name} (Etapa: ${s.stage}): ${s.notes || "Sin detalles"}`
              )
              .join("\n")
          : undefined;

      const assistantMsgId = `assistant-${Date.now() + 1}`;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            agentName: activeAgent.name,
            sellerContext,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Error del servidor (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snapshot = accumulated;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: snapshot } : m
            )
          );
        }

        if (accumulated.trim()) {
          await saveMessage({
            id: assistantMsgId,
            session_id: sessionId,
            role: "assistant",
            content: accumulated,
          });

          // Mantener el Plan de Marketing actualizado automáticamente cuando se conversa sobre planes, propiedades o fotos
          const lowerPrompt = userText.toLowerCase();
          const shouldAutoSyncPlan =
            (imagesToSend && imagesToSend.length > 0) ||
            lowerPrompt.includes("plan") ||
            lowerPrompt.includes("propiedad") ||
            lowerPrompt.includes("reel") ||
            lowerPrompt.includes("carrusel") ||
            lowerPrompt.includes("secuencia");

          if (shouldAutoSyncPlan) {
            const autoTitle =
              imagesToSend && imagesToSend.length > 0
                ? "📸 Análisis de Fotos: Estrategia Propiedad"
                : lowerPrompt.includes("plan")
                ? "📋 Planificación de Contenido Sugerida"
                : "✨ Estrategia del Asistente";
            await handleSaveAssistantMessageToPlan(
              assistantMsgId,
              accumulated,
              autoTitle
            );
          }
        }
      } catch (err) {
        console.error("Error en streaming:", err);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantMsgId),
          {
            id: assistantMsgId,
            role: "assistant",
            content:
              "⚠️ Hubo un problema al conectar con el asistente. Probá enviar de nuevo en unos segundos.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      sessionId,
      activeAgent,
      sellerContacts,
      handleSaveAssistantMessageToPlan,
    ]
  );

  // Auto-scroll suave
  useEffect(() => {
    if (activeSection === "copilot") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, activeSection]);

  // Auto-ajuste de altura del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachedImages.length === 0) || isLoading) return;
    const imgs = [...attachedImages];
    setInput("");
    setAttachedImages([]);
    await sendMessageAndStream(
      trimmed ||
        "Analizá estas fotos de la propiedad y aconsejame si conviene un Carrusel o un Video conmigo en primera persona mostrando la propiedad.",
      messages,
      imgs
    );
  };

  const handleQuickAction = async (action: QuickAction) => {
    if (isLoading) return;

    if (action.triggerPhotoPicker) {
      setInput(action.prompt);
      fileInputRef.current?.click();
      return;
    }

    if (action.prefillOnly) {
      setInput(action.prompt);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return;
    }

    await sendMessageAndStream(action.prompt, messages);
  };

  const handleClearChat = async () => {
    if (isLoading) return;
    await clearSessionMessages(sessionId);
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachedImages.length > 0) && !isLoading) {
        const form = e.currentTarget.form;
        if (form) form.requestSubmit();
      }
    }
  };

  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] max-w-md mx-auto bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
        <p className="text-xs text-zinc-500">Verificando sesión...</p>
      </div>
    );
  }

  if (!activeAgent) {
    return <AuthScreen />;
  }

  const pendingPlanCount = planItems.filter(
    (i) => i.status !== "publicado"
  ).length;

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-slate-50 dark:bg-zinc-950 border-x border-zinc-200/70 dark:border-zinc-800/70 shadow-xl overflow-hidden">
      {/* 1. HEADER FIJO */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-3.5 py-2.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Agente Inmobiliario
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                En línea
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            <span className="h-6 w-6 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeAgent.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 max-w-[90px] truncate">
              {activeAgent.name}
            </span>
          </div>

          {activeSection === "copilot" && messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClearChat}
              title="Limpiar conversación"
              aria-label="Limpiar conversación"
              className="h-8 w-8 rounded-xl text-zinc-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="h-8 w-8 rounded-xl text-zinc-400 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* SECCIÓN 1: ASISTENTE DE MARKETING (CON SUBIDA DE FOTOS) */}
      {activeSection === "copilot" && (
        <>
          <main className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
            {historyLoaded && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center px-4 py-8 my-auto">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  ¡Hola {activeAgent.name}! ¿Qué grabamos o publicamos hoy? ✨
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
                  Subí <strong>fotos de una propiedad (📷)</strong> para que te
                  aconseje si conviene armar un <strong>Carrusel</strong> o un{" "}
                  <strong>Video en 1ra persona mostrando la propiedad</strong>,
                  y todo se guarda en tu pestaña <strong>📅 Plan</strong>.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              const isCopied = copiedId === message.id;
              const isSavedPlan = savedToPlanId === message.id;

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[92%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs shadow-sm ${
                        isUser
                          ? "bg-emerald-600 text-white"
                          : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {isUser ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        isUser
                          ? "bg-emerald-600 text-white rounded-br-sm"
                          : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-800 rounded-bl-sm"
                      }`}
                    >
                      {/* Fotos subidas en el mensaje del usuario */}
                      {isUser &&
                        message.images &&
                        message.images.length > 0 && (
                          <div className="grid grid-cols-2 gap-1.5 mb-2">
                            {message.images.map((imgSrc, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={imgSrc}
                                alt={`Foto propiedad ${i + 1}`}
                                className="h-28 w-full object-cover rounded-xl border border-white/20"
                              />
                            ))}
                          </div>
                        )}

                      {isUser ? (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      ) : (
                        <MarkdownRenderer content={message.content} />
                      )}

                      {!isUser && message.content && (
                        <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveAssistantMessageToPlan(
                                message.id,
                                message.content
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              isSavedPlan
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                                : "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                            }`}
                          >
                            {isSavedPlan ? (
                              <>
                                <CalendarCheck2 className="h-3.5 w-3.5" />
                                <span>En tu Plan ✅</span>
                              </>
                            ) : (
                              <>
                                <CalendarPlus className="h-3.5 w-3.5" />
                                <span>Guardar en Plan</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(message.id, message.content)
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              isCopied
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                                : "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
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
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading &&
              (messages.length === 0 ||
                messages[messages.length - 1]?.role === "user") && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 pl-2">
                  <div className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-emerald-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <span>
                    Analizando y actualizando tu Plan de Marketing...
                  </span>
                </div>
              )}

            <div ref={messagesEndRef} />
          </main>

          {/* ZONA INFERIOR: MINIATURAS DE FOTOS + CHIPS + INPUT CON CÁMARA */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 pt-2 pb-2.5 px-3">
            {/* Vista previa de fotos seleccionadas antes de enviar */}
            {attachedImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1">
                {attachedImages.map((imgSrc, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc}
                      alt={`Adjunto ${idx + 1}`}
                      className="h-16 w-16 object-cover rounded-xl border border-emerald-500/50 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachedImage(idx)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Chips rápidos */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleQuickAction(action)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 hover:border-emerald-500/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <span>{action.emoji}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Input oculto para subir fotos de la propiedad */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />

            <form onSubmit={onFormSubmit} className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                title="Subir fotos de una propiedad"
                aria-label="Subir fotos de una propiedad"
                className="h-10 w-10 rounded-2xl flex-shrink-0 text-emerald-600 dark:text-emerald-400 border-zinc-200 dark:border-zinc-700"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>

              <div className="relative flex-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-2xl border border-zinc-200/90 dark:border-zinc-700/80 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Subí fotos (📷) o escribí una propiedad..."
                  disabled={isLoading}
                  className="w-full max-h-[132px] bg-transparent px-3.5 py-2.5 text-[15px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none leading-snug"
                />
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={
                  isLoading || (!input.trim() && attachedImages.length === 0)
                }
                aria-label="Enviar mensaje"
                className="h-10 w-10 rounded-2xl flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </>
      )}

      {/* SECCIÓN 2: PLAN DE MARKETING EJECUTABLE */}
      {activeSection === "plan" && (
        <MarketingPlanView
          activeAgent={activeAgent}
          planItems={planItems}
          setPlanItems={setPlanItems}
          sellerContacts={sellerContacts}
          recentChatMessages={messages}
          onGoToAssistant={(prefill) => {
            if (prefill) setInput(prefill);
            setActiveSection("copilot");
            setTimeout(() => fileInputRef.current?.click(), 120);
          }}
        />
      )}

      {/* SECCIÓN 3: PROPIEDADES */}
      {activeSection === "properties" && (
        <PropertiesView
          activeAgent={activeAgent}
          contacts={allContacts}
          properties={properties}
          onPropertiesChange={setProperties}
          onGoToCRM={() => setActiveSection("crm")}
        />
      )}

      {/* SECCIÓN 4: MINI CRM MULTI-AGENTE */}
      {activeSection === "crm" && (
        <CRMView
          activeAgent={activeAgent}
          agents={[activeAgent]}
          planItems={planItems}
          properties={properties}
          onPropertiesChange={setProperties}
          templates={whatsappTemplates}
          onPlanUpdated={(nextItems) => {
            setPlanItems(nextItems);
            loadCRMContacts().then((all) => {
              setAllContacts(all);
              setSellerContacts(
                all.filter(
                  (c) => c.type === "seller" && c.agent_id === activeAgent.id
                )
              );
            });
          }}
          onGoToPlan={() => setActiveSection("plan")}
          onGoToTemplates={() => setActiveSection("templates")}
          onGoToProperties={() => setActiveSection("properties")}
        />
      )}

      {/* SECCIÓN 5: PLANTILLAS DE WHATSAPP EDITABLES */}
      {activeSection === "templates" && (
        <WhatsAppTemplatesView
          activeAgent={activeAgent}
          templates={whatsappTemplates}
          onTemplatesChange={setWhatsappTemplates}
        />
      )}

      {/* 3. BARRA DE NAVEGACIÓN INFERIOR FIJA (5 SECCIONES: ASISTENTE | PLAN | PROPIEDADES | CRM | PLANTILLAS) */}
      <nav
        aria-label="Navegación principal"
        className="z-20 grid grid-cols-5 bg-white dark:bg-zinc-900 border-t border-zinc-200/90 dark:border-zinc-800 px-1 py-1.5 gap-0.5"
      >
        <button
          type="button"
          onClick={() => setActiveSection("copilot")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
            activeSection === "copilot"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          <span className="text-[10px] mt-0.5 truncate">Asistente</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("plan")}
          className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
            activeSection === "plan"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          }`}
        >
          <div className="relative">
            <CalendarCheck2 className="h-4 w-4" />
            {pendingPlanCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[15px] h-3.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingPlanCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 truncate">Plan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("properties")}
          className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
            activeSection === "properties"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span className="text-[10px] mt-0.5 truncate">Propiedades</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("crm")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
            activeSection === "crm"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          }`}
        >
          <Users className="h-4 w-4" />
          <span className="text-[10px] mt-0.5 truncate">CRM</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("templates")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
            activeSection === "templates"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium"
          }`}
        >
          <FileEdit className="h-4 w-4" />
          <span className="text-[10px] mt-0.5 truncate">Plantillas</span>
        </button>
      </nav>
    </div>
  );
}

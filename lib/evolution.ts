export type ContactType = "seller" | "buyer";

export type SellerStage =
  | "prospecto"
  | "tasacion_pendiente"
  | "captado"
  | "en_promocion"
  | "cerrado"
  | "perdido";

export type BuyerStage =
  | "lead_nuevo"
  | "calificado"
  | "visita_agendada"
  | "en_negociacion"
  | "cerrado"
  | "descartado";

export type ContactStage = SellerStage | BuyerStage;

export type DefaultTemplateType =
  | "seller_tasacion"
  | "seller_captado"
  | "seller_promocion"
  | "buyer_visita"
  | "buyer_seguimiento"
  | "buyer_negociacion";

export type TemplateType = DefaultTemplateType | (string & {});

export interface WhatsAppTemplate {
  id: TemplateType;
  label: string;
  forType: ContactType;
  recommendedStage: ContactStage;
  body: string;
  isCustom?: boolean;
}

export const WHATSAPP_TEMPLATES: Record<DefaultTemplateType, WhatsAppTemplate> = {
  seller_tasacion: {
    id: "seller_tasacion",
    label: "Vendedor • Coordinar Tasación",
    forType: "seller",
    recommendedStage: "tasacion_pendiente",
    body: "Hola {{name}}, ¿cómo estás? Te escribe {{agent}}. Te escribo para coordinar la visita a la propiedad y entregarte la tasación real de mercado en CABA. ¿Qué día te queda más cómodo?",
  },
  seller_captado: {
    id: "seller_captado",
    label: "Vendedor • Propiedad Captada / Producción",
    forType: "seller",
    recommendedStage: "captado",
    body: "Hola {{name}}, ¡qué alegría avanzar juntos con la venta! Soy {{agent}}, esta semana coordinamos para hacer los videos formato Reel y fotos profesionales de la propiedad. ¿Qué horario te viene mejor?",
  },
  seller_promocion: {
    id: "seller_promocion",
    label: "Vendedor • Reporte en Promoción",
    forType: "seller",
    recommendedStage: "en_promocion",
    body: "Hola {{name}}, ¿cómo va? Te escribe {{agent}}. Te cuento que ya está activo el Reel y la publicación de tu propiedad y estamos recibiendo las primeras consultas calificadas. Te mantengo al tanto de las visitas.",
  },
  buyer_visita: {
    id: "buyer_visita",
    label: "Comprador • Visita Agendada",
    forType: "buyer",
    recommendedStage: "visita_agendada",
    body: "Hola {{name}}, soy {{agent}}, te confirmo nuestra visita para ver la propiedad. Te paso la ubicación exacta por acá. Cualquier duda avisame.",
  },
  buyer_seguimiento: {
    id: "buyer_seguimiento",
    label: "Comprador • Seguimiento Nuevas Opciones",
    forType: "buyer",
    recommendedStage: "calificado",
    body: "Hola {{name}}, soy {{agent}}. Entraron un par de opciones nuevas que coinciden con lo que buscabas. Si seguís buscando avísame y te paso los videos antes de publicarlos.",
  },
  buyer_negociacion: {
    id: "buyer_negociacion",
    label: "Comprador • Avance de Negociación",
    forType: "buyer",
    recommendedStage: "en_negociacion",
    body: "Hola {{name}}, te escribe {{agent}}. Ya presenté formalmente tu propuesta a los propietarios. Ni bien tenga respuesta te llamo para contarte cómo seguimos.",
  },
};

export function getDefaultTemplatesList(): WhatsAppTemplate[] {
  return Object.values(WHATSAPP_TEMPLATES).map((tpl) => ({ ...tpl }));
}

export function getDefaultTemplateForStage(
  type: ContactType,
  stage: ContactStage,
  templates?: WhatsAppTemplate[]
): TemplateType {
  if (templates && templates.length > 0) {
    const exactMatch = templates.find(
      (t) => t.forType === type && t.recommendedStage === stage
    );
    if (exactMatch) return exactMatch.id;
  }

  if (type === "seller") {
    if (stage === "captado") return "seller_captado";
    if (stage === "en_promocion") return "seller_promocion";
    return "seller_tasacion";
  } else {
    if (stage === "visita_agendada") return "buyer_visita";
    if (stage === "en_negociacion") return "buyer_negociacion";
    return "buyer_seguimiento";
  }
}

export function renderWhatsAppTemplateBody(
  body: string,
  contactName: string,
  agentName = "Fiorella"
): string {
  const firstName = contactName.trim().split(" ")[0] || contactName.trim();
  const cleanAgent = agentName.trim() || "Fiorella";
  return body
    .replace(/\{\{name\}\}/g, firstName)
    .replace(/\{\{agent\}\}/g, cleanAgent);
}

export function renderWhatsAppTemplate(
  templateType: TemplateType,
  contactName: string,
  agentName = "Fiorella",
  customTemplates?: WhatsAppTemplate[]
): string {
  const foundCustom = customTemplates?.find((t) => t.id === templateType);
  const tpl =
    foundCustom ||
    WHATSAPP_TEMPLATES[templateType as DefaultTemplateType] ||
    WHATSAPP_TEMPLATES.buyer_seguimiento;
  return renderWhatsAppTemplateBody(tpl.body, contactName, agentName);
}

/**
 * Normaliza un número telefónico a formato internacional para Evolution API (ej: 54911xxxxxxxx).
 */
export function normalizePhoneForWhatsApp(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("11")) {
    return `549${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("15")) {
    return `54911${digits.slice(2)}`;
  }
  if (digits.startsWith("011") && digits.length === 11) {
    return `54911${digits.slice(3)}`;
  }
  if (digits.startsWith("5411") && digits.length === 12) {
    return `549${digits.slice(2)}`;
  }
  return digits;
}

export function getEvolutionConfig() {
  const greenIdInstance = (process.env.GREEN_API_ID_INSTANCE || "").trim();
  const greenApiToken = (process.env.GREEN_API_TOKEN_INSTANCE || "").trim();
  const greenApiUrl = (
    process.env.GREEN_API_URL || "https://api.green-api.com"
  ).replace(/\/$/, "");

  const whapiToken = (process.env.WHAPI_TOKEN || "").trim();
  const whapiUrl = (
    process.env.WHAPI_API_URL || "https://gate.whapi.cloud"
  ).replace(/\/$/, "");

  const baseUrl = (
    process.env.EVOLUTION_API_URL || "http://localhost:8080"
  ).replace(/\/$/, "");
  const apiKey = (process.env.EVOLUTION_API_KEY || "").trim();
  const instanceName = (
    process.env.EVOLUTION_INSTANCE_NAME ||
    process.env.EVOLUTION_INSTANCE ||
    "fiorella"
  ).trim();

  return {
    baseUrl,
    apiKey,
    instanceName,
    whapiToken,
    whapiUrl,
    greenIdInstance,
    greenApiToken,
    greenApiUrl,
  };
}

export interface EvolutionSendResult {
  ok: boolean;
  sent?: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

/**
 * Envía un mensaje de texto usando Evolution API (compatible con mcp-evolution-api v1 y v2):
 * POST ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}
 */
export async function sendEvolutionTextMessage(params: {
  to: string;
  body: string;
}): Promise<EvolutionSendResult> {
  const {
    baseUrl,
    apiKey,
    instanceName,
    whapiToken,
    whapiUrl,
    greenIdInstance,
    greenApiToken,
    greenApiUrl,
  } = getEvolutionConfig();

  const normalizedPhone = normalizePhoneForWhatsApp(params.to);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      ok: false,
      error: `Número de teléfono inválido (${params.to}). Usá formato internacional ej: 54911xxxxxxxx.`,
    };
  }

  // 1. Si está configurado GREEN-API (nube gratuita Developer sin Docker)
  if (greenIdInstance && greenApiToken) {
    try {
      const res = await fetch(
        `${greenApiUrl}/waInstance${greenIdInstance}/sendMessage/${greenApiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: `${normalizedPhone}@c.us`,
            message: params.body,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.idMessage) {
        return {
          ok: false,
          error:
            data?.message ||
            data?.error ||
            `Error de Green-API (${res.status}). Verificá que la instancia esté autorizada.`,
          raw: data,
        };
      }
      return {
        ok: true,
        sent: true,
        messageId: data.idMessage,
        raw: data,
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Error al conectar con Green-API",
      };
    }
  }

  // 2. Si hay WHAPI_TOKEN configurado, enviar directamente por Whapi.Cloud en la nube
  if (whapiToken) {
    try {
      const res = await fetch(`${whapiUrl}/messages/text`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whapiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: normalizedPhone,
          body: params.body,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          error:
            data?.error?.message ||
            data?.message ||
            `Error de Whapi.Cloud (${res.status})`,
          raw: data,
        };
      }
      return {
        ok: true,
        sent: true,
        messageId: data?.message?.id || data?.id,
        raw: data,
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Error al conectar con Whapi.Cloud",
      };
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      error:
        "Falta configurar WHAPI_TOKEN o EVOLUTION_API_KEY en el servidor.",
    };
  }

  try {
    const response = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: params.body,
          // Compatibilidad hacia atrás si el servidor corre Evolution API v1
          textMessage: {
            text: params.body,
          },
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMessage =
        data?.response?.message?.[0] ||
        data?.error ||
        data?.message ||
        `Error de Evolution API (${response.status})`;
      return {
        ok: false,
        error:
          typeof errMessage === "string"
            ? errMessage
            : JSON.stringify(errMessage),
        raw: data,
      };
    }

    return {
      ok: true,
      sent: true,
      messageId: data?.key?.id || data?.id,
      raw: data,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo conectar con Evolution API (${baseUrl}): ${err.message}`
          : "No se pudo conectar con Evolution API",
    };
  }
}

export interface EvolutionStatusResult {
  configured: boolean;
  connected: boolean;
  instanceName: string;
  statusText: string;
  qrBase64?: string;
  pairingCode?: string;
  error?: string;
}

/**
 * Consulta el estado de la instancia en Evolution API:
 * GET ${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}
 * Si fetchQr=true y no está conectada, solicita el QR en:
 * GET ${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}
 * (Y si la instancia aún no existe, intenta crearla automáticamente).
 */
export async function checkEvolutionInstanceStatus(options?: {
  fetchQr?: boolean;
  action?: "logout" | "pairingCode";
  phoneNumber?: string;
}): Promise<EvolutionStatusResult> {
  const {
    baseUrl,
    apiKey,
    instanceName,
    whapiToken,
    whapiUrl,
    greenIdInstance,
    greenApiToken,
    greenApiUrl,
  } = getEvolutionConfig();

  if (greenIdInstance && greenApiToken) {
    try {
      // Acción 1: Desvincular el WhatsApp actual para que Fiorella pueda conectar el suyo
      if (options?.action === "logout") {
        await fetch(
          `${greenApiUrl}/waInstance${greenIdInstance}/logout/${greenApiToken}`,
          { method: "GET", cache: "no-store" }
        );
      }

      // Acción 2: Generar código de 8 dígitos por número de teléfono (ideal desde el mismo celular)
      let pairingCode: string | undefined;
      if (options?.action === "pairingCode" && options?.phoneNumber) {
        const cleanNum = Number(normalizePhoneForWhatsApp(options.phoneNumber));
        const codeRes = await fetch(
          `${greenApiUrl}/waInstance${greenIdInstance}/getAuthorizationCode/${greenApiToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: cleanNum }),
          }
        );
        const codeData = await codeRes.json().catch(() => ({}));
        if (codeData?.status && typeof codeData?.code === "string") {
          pairingCode = codeData.code;
        }
      }

      const stateRes = await fetch(
        `${greenApiUrl}/waInstance${greenIdInstance}/getStateInstance/${greenApiToken}`,
        { method: "GET", cache: "no-store" }
      );
      const stateData = await stateRes.json().catch(() => ({}));
      const stateInstance: string = stateData?.stateInstance || "notAuthorized";
      const isConnected = stateInstance === "authorized";

      let qrBase64: string | undefined;
      if (!isConnected && options?.fetchQr) {
        const qrRes = await fetch(
          `${greenApiUrl}/waInstance${greenIdInstance}/qr/${greenApiToken}`,
          { method: "GET", cache: "no-store" }
        );
        const qrData = await qrRes.json().catch(() => ({}));
        if (qrData?.type === "qrCode" && typeof qrData?.message === "string") {
          qrBase64 = `data:image/png;base64,${qrData.message}`;
        }
      }

      return {
        configured: true,
        connected: isConnected,
        instanceName: `green-api (${greenIdInstance})`,
        statusText: isConnected
          ? "Conectado (Green-API)"
          : "Listo para vincular el WhatsApp de Fiorella",
        qrBase64,
        pairingCode,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        instanceName: "green-api",
        statusText: "Error al conectar con Green-API",
        error: err instanceof Error ? err.message : "Error de red",
      };
    }
  }

  if (whapiToken) {
    try {
      const healthRes = await fetch(`${whapiUrl}/health?wakeup=true`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${whapiToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const healthData = await healthRes.json().catch(() => ({}));
      const statusText: string =
        healthData?.status?.text || healthData?.status || "UNKNOWN";
      const isConnected = statusText === "AUTH" || statusText === "CONNECTED";

      let qrBase64: string | undefined;
      if (!isConnected && options?.fetchQr) {
        const qrRes = await fetch(`${whapiUrl}/users/login`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${whapiToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        const qrData = await qrRes.json().catch(() => ({}));
        const rawQr = qrData?.base64 || qrData?.qr || qrData?.image;
        if (typeof rawQr === "string" && rawQr.length > 0) {
          qrBase64 = rawQr.startsWith("data:image")
            ? rawQr
            : `data:image/png;base64,${rawQr}`;
        }
      }

      return {
        configured: true,
        connected: isConnected,
        instanceName: "whapi-cloud",
        statusText: isConnected ? "Conectado (Whapi.Cloud)" : statusText,
        qrBase64,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        instanceName: "whapi-cloud",
        statusText: "Error al conectar con Whapi.Cloud",
        error: err instanceof Error ? err.message : "Error de red",
      };
    }
  }

  if (!apiKey) {
    return {
      configured: false,
      connected: false,
      instanceName,
      statusText: "Sin WHAPI_TOKEN / EVOLUTION_API_KEY",
    };
  }

  try {
    const stateRes = await fetch(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      {
        method: "GET",
        headers: {
          apikey: apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const stateData = await stateRes.json().catch(() => ({}));

    // Si la instancia no existe (404) y pidieron QR, la creamos automáticamente en Evolution API
    if (stateRes.status === 404 && options?.fetchQr) {
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      const createData = await createRes.json().catch(() => ({}));
      const createdQr =
        createData?.qrcode?.base64 || createData?.base64 || undefined;

      if (createRes.ok) {
        return {
          configured: true,
          connected: false,
          instanceName,
          statusText: "Instancia creada • Escaneá el QR",
          qrBase64: createdQr,
        };
      }
    }

    if (!stateRes.ok && stateRes.status !== 404) {
      return {
        configured: true,
        connected: false,
        instanceName,
        statusText: "Error de autenticación o instancia",
        error:
          stateData?.response?.message ||
          stateData?.message ||
          `HTTP ${stateRes.status}`,
      };
    }

    const rawState: string =
      stateData?.instance?.state || stateData?.state || "close";
    const isConnected = rawState === "open";

    let qrBase64: string | undefined;
    let pairingCode: string | undefined;

    if (!isConnected && options?.fetchQr) {
      const connectRes = await fetch(
        `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
        {
          method: "GET",
          headers: {
            apikey: apiKey,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      const connectData = await connectRes.json().catch(() => ({}));
      const rawQr =
        connectData?.base64 ||
        connectData?.qrcode?.base64 ||
        connectData?.qr;

      if (typeof rawQr === "string" && rawQr.length > 0) {
        qrBase64 = rawQr.startsWith("data:image")
          ? rawQr
          : `data:image/png;base64,${rawQr}`;
      }
      if (typeof connectData?.pairingCode === "string") {
        pairingCode = connectData.pairingCode;
      }
    }

    return {
      configured: true,
      connected: isConnected,
      instanceName,
      statusText: isConnected
        ? "Conectado (open)"
        : rawState === "connecting"
        ? "Conectando..."
        : "Pendiente de vincular QR",
      qrBase64,
      pairingCode,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      instanceName,
      statusText: "Servidor Evolution API no alcanzable",
      error: err instanceof Error ? err.message : "Error de conexión",
    };
  }
}

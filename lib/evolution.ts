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

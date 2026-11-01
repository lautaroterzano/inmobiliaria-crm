// Re-exporta desde lib/evolution.ts para mantener compatibilidad de tipos en el proyecto
export {
  type ContactType,
  type SellerStage,
  type BuyerStage,
  type ContactStage,
  type DefaultTemplateType,
  type TemplateType,
  type WhatsAppTemplate as WhapiTemplate,
  WHATSAPP_TEMPLATES as WHAPI_TEMPLATES,
  getDefaultTemplatesList,
  getDefaultTemplateForStage,
  renderWhatsAppTemplateBody,
  renderWhatsAppTemplate as renderWhapiTemplate,
  normalizePhoneForWhatsApp as normalizePhoneForWhapi,
  sendEvolutionTextMessage as sendWhapiTextMessage,
  checkEvolutionInstanceStatus as checkWhapiChannelStatus,
  type EvolutionStatusResult as WhapiStatusResult,
} from "./evolution";

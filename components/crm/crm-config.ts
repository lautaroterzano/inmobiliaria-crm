import type { BuyerStage, ContactStage, ContactType, SellerStage } from "@/lib/whapi";

export interface StageDefinition {
  id: ContactStage;
  label: string;
  shortDesc: string;
  badgeClass: string;
}

export const SELLER_STAGES: StageDefinition[] = [
  {
    id: "prospecto",
    label: "Prospecto",
    shortDesc: "Contacto inicial / dueño directo / referido",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  {
    id: "tasacion_pendiente",
    label: "Tasación pendiente",
    shortDesc: "Pendiente de coordinar o entregar tasación en CABA",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  },
  {
    id: "captado",
    label: "Captado",
    shortDesc: "Propiedad firmada / autorizada para venta",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  },
  {
    id: "en_promocion",
    label: "En promoción",
    shortDesc: "Con fotos/videos y publicaciones activas",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
  },
  {
    id: "cerrado",
    label: "Cerrado",
    shortDesc: "Operación concretada",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  {
    id: "perdido",
    label: "Perdido",
    shortDesc: "No firmó o vendió por su cuenta",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  },
];

export const BUYER_STAGES: StageDefinition[] = [
  {
    id: "lead_nuevo",
    label: "Lead nuevo",
    shortDesc: "Consultó por propiedad o búsqueda general",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  {
    id: "calificado",
    label: "Calificado",
    shortDesc: "Presupuesto claro, zona en CABA y forma de pago",
    badgeClass:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60",
  },
  {
    id: "visita_agendada",
    label: "Visita agendada",
    shortDesc: "Visita coordinada a una propiedad",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  },
  {
    id: "en_negociacion",
    label: "En negociación",
    shortDesc: "Con reserva o contraoferta presentada",
    badgeClass:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
  },
  {
    id: "cerrado",
    label: "Cerrado",
    shortDesc: "Compra finalizada",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  {
    id: "descartado",
    label: "Descartado",
    shortDesc: "No califica o pausó la búsqueda",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  },
];

export function getStagesForType(type: ContactType): StageDefinition[] {
  return type === "seller" ? SELLER_STAGES : BUYER_STAGES;
}

export function getStageDefinition(
  type: ContactType,
  stage: ContactStage
): StageDefinition {
  const list = getStagesForType(type);
  return list.find((s) => s.id === stage) || list[0];
}

export const DEFAULT_STAGE_BY_TYPE: Record<
  ContactType,
  SellerStage | BuyerStage
> = {
  seller: "prospecto",
  buyer: "lead_nuevo",
};

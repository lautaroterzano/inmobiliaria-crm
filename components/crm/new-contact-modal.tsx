"use client";

import React, { useEffect, useState } from "react";
import { X, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_STAGE_BY_TYPE,
  getStagesForType,
} from "@/components/crm/crm-config";
import {
  normalizePhoneForWhapi,
  type ContactStage,
  type ContactType,
} from "@/lib/whapi";
import type { PropertyItem } from "@/lib/supabase";

interface NewContactModalProps {
  open: boolean;
  defaultType: ContactType;
  properties?: PropertyItem[];
  onClose: () => void;
  onCreate: (data: {
    name: string;
    phone: string;
    type: ContactType;
    stage: ContactStage;
    notes?: string;
    propertyId?: string | null;
  }) => Promise<void>;
}

export function NewContactModal({
  open,
  defaultType,
  properties = [],
  onClose,
  onCreate,
}: NewContactModalProps) {
  const [type, setType] = useState<ContactType>(defaultType);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("54911");
  const [stage, setStage] = useState<ContactStage>(
    DEFAULT_STAGE_BY_TYPE[defaultType]
  );
  const [notes, setNotes] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setStage(DEFAULT_STAGE_BY_TYPE[defaultType]);
      setName("");
      setPhone("54911");
      setNotes("");
      setSelectedPropertyId("");
    }
  }, [open, defaultType]);

  if (!open) return null;

  const stages = getStagesForType(type);

  const handleTypeChange = (nextType: ContactType) => {
    setType(nextType);
    setStage(DEFAULT_STAGE_BY_TYPE[nextType]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        phone: normalizePhoneForWhapi(phone),
        type,
        stage,
        notes: notes.trim() || undefined,
        propertyId: selectedPropertyId || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Nuevo Contacto CRM
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Selector de Funnel */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => handleTypeChange("seller")}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                type === "seller"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              🏠 Vendedor (Captación)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("buyer")}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                type === "buyer"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              🔍 Comprador (Búsqueda)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Nombre y Apellido *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Martín Gómez"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Teléfono WhatsApp (formato internacional) *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="54911xxxxxxxx"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm font-mono text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Ej CABA: 54911 + los 8 dígitos (sin 0 ni 15).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Etapa del Funnel
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as ContactStage)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.shortDesc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notas (barrio, ambientes, presupuesto o tasación)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                type === "seller"
                  ? "Ej: Dueño 3 amb en Caballito con balcón, quiere tasar..."
                  : "Ej: Busca 2 amb en Palermo/Belgrano hasta USD 120.000 efectivo..."
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Asignar Propiedad opcionalmente desde el alta del contacto */}
          {properties.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Asignar Propiedad {type === "seller" ? "(En venta)" : "(De interés)"}
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- Sin propiedad asignada por ahora --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address} ({p.property_type} - {p.price || "s/d"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !phone.trim()}
              className="flex-1"
            >
              {submitting ? "Guardando..." : "Guardar Contacto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

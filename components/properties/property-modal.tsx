"use client";

import React, { useState } from "react";
import { X, Building2, UserCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_TYPES,
  type PropertyType,
  type CRMContact,
  type PropertyItem,
} from "@/lib/supabase";

interface PropertyModalProps {
  open: boolean;
  onClose: () => void;
  propertyToEdit?: PropertyItem | null;
  contacts: CRMContact[];
  onSave: (data: {
    address: string;
    price: string;
    expenses: string;
    property_type: PropertyType;
    seller_contact_id: string | null;
    buyer_contact_id: string | null;
  }) => Promise<void>;
}

export function PropertyModal({
  open,
  onClose,
  propertyToEdit,
  contacts,
  onSave,
}: PropertyModalProps) {
  const [address, setAddress] = useState(propertyToEdit?.address || "");
  const [price, setPrice] = useState(propertyToEdit?.price || "");
  const [expenses, setExpenses] = useState(propertyToEdit?.expenses || "");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    propertyToEdit?.property_type || "Departamento"
  );
  const [sellerId, setSellerId] = useState<string>(
    propertyToEdit?.seller_contact_id || ""
  );
  const [buyerId, setBuyerId] = useState<string>(
    propertyToEdit?.buyer_contact_id || ""
  );
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setAddress(propertyToEdit?.address || "");
      setPrice(propertyToEdit?.price || "");
      setExpenses(propertyToEdit?.expenses || "");
      setPropertyType(propertyToEdit?.property_type || "Departamento");
      setSellerId(propertyToEdit?.seller_contact_id || "");
      setBuyerId(propertyToEdit?.buyer_contact_id || "");
    }
  }, [open, propertyToEdit]);

  if (!open) return null;

  const sellers = contacts.filter((c) => c.type === "seller");
  const buyers = contacts.filter((c) => c.type === "buyer");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onSave({
        address: address.trim(),
        price: price.trim(),
        expenses: expenses.trim(),
        property_type: propertyType,
        seller_contact_id: sellerId || null,
        buyer_contact_id: buyerId || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              {propertyToEdit ? "Editar Propiedad" : "Nueva Propiedad"}
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
          {/* Tipo de Propiedad */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Tipo de Propiedad *
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Dirección *
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Santa Fe 3400, Palermo"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Precio y Expensas */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Precio (USD / $)
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ej: USD 135.000"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Expensas
              </label>
              <input
                type="text"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                placeholder="Ej: $ 95.000"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Asignación de Vendedor */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              🏠 Vendedor Asignado (Propietario)
            </label>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Sin Vendedor Asignado --</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.agent_name})
                </option>
              ))}
            </select>
          </div>

          {/* Asignación de Comprador */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              🔍 Comprador Asignado (Interesado / Reserva)
            </label>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">-- Sin Comprador Asignado --</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.agent_name})
                </option>
              ))}
            </select>
          </div>

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
              disabled={submitting || !address.trim()}
              className="flex-1"
            >
              {submitting ? "Guardando..." : "Guardar Propiedad"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Search,
  User,
  Users,
  DollarSign,
  Receipt,
  MapPin,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyModal } from "./property-modal";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  type AgentProfile,
  type CRMContact,
  type PropertyItem,
  type PropertyType,
} from "@/lib/supabase";

interface PropertiesViewProps {
  activeAgent: AgentProfile;
  contacts: CRMContact[];
  properties: PropertyItem[];
  onPropertiesChange: (next: PropertyItem[]) => void;
  onGoToCRM?: () => void;
}

export function PropertiesView({
  activeAgent,
  contacts,
  properties,
  onPropertiesChange,
  onGoToCRM,
}: PropertiesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyItem | null>(null);

  const handleOpenCreate = () => {
    setEditingProperty(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (prop: PropertyItem) => {
    setEditingProperty(prop);
    setModalOpen(true);
  };

  const handleSaveProperty = async (data: {
    address: string;
    price: string;
    expenses: string;
    property_type: PropertyType;
    seller_contact_id: string | null;
    buyer_contact_id: string | null;
  }) => {
    if (editingProperty) {
      const updated = await updateProperty(editingProperty.id, data);
      onPropertiesChange(updated);
    } else {
      const res = await createProperty({
        ...data,
        agent_id: activeAgent.id,
        agent_name: activeAgent.name,
      });
      onPropertiesChange(res.allProperties);
    }
  };

  const handleDelete = async (propId: string) => {
    if (confirm("¿Estás segura de eliminar esta propiedad?")) {
      const updated = await deleteProperty(propId);
      onPropertiesChange(updated);
    }
  };

  const filtered = properties.filter((prop) => {
    const matchesSearch =
      prop.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.property_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.price.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedTypeFilter === "all" || prop.property_type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* HEADER DE PROPIEDADES */}
      <div className="px-3.5 pt-2.5 pb-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                Cartera de Propiedades
              </h2>
              <p className="text-[11px] text-zinc-500">
                {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"} registradas
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            className="h-8 rounded-xl px-3 text-xs font-semibold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nueva Propiedad</span>
          </Button>
        </div>

        {/* BUSCADOR */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por dirección, tipo o precio..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* LISTADO DE PROPIEDADES */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-zinc-900 dark:text-white">
              {properties.length === 0
                ? "Aún no tenés propiedades registradas"
                : "No se encontraron propiedades"}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Tocá en &ldquo;+ Nueva Propiedad&rdquo; para cargar la dirección, precio, expensas y vincular a sus compradores y vendedores.
            </p>
          </div>
        ) : (
          filtered.map((prop) => {
            const seller = contacts.find((c) => c.id === prop.seller_contact_id);
            const buyer = contacts.find((c) => c.id === prop.buyer_contact_id);

            return (
              <div
                key={prop.id}
                className="rounded-2xl p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-3"
              >
                {/* Cabecera de la tarjeta: Tipo y Acciones */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    {prop.property_type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(prop)}
                      title="Editar propiedad"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(prop.id)}
                      title="Eliminar propiedad"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>{prop.address}</span>
                  </h3>
                </div>

                {/* Precio y Expensas */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Precio</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {prop.price || "A consultar"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <Receipt className="h-3.5 w-3.5 text-blue-500" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block">Expensas</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {prop.expenses || "Sin expensas"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vendedor y Comprador Asignados */}
                <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  {/* Vendedor */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <span className="font-semibold text-[11px]">🏠 Vendedor:</span>
                      {seller ? (
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {seller.name}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">No asignado</span>
                      )}
                    </div>
                    {seller && onGoToCRM && (
                      <button
                        type="button"
                        onClick={onGoToCRM}
                        className="text-[10px] text-emerald-600 font-semibold underline"
                      >
                        Ver en CRM
                      </button>
                    )}
                  </div>

                  {/* Comprador */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <span className="font-semibold text-[11px]">🔍 Comprador:</span>
                      {buyer ? (
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {buyer.name}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">No asignado</span>
                      )}
                    </div>
                    {buyer && onGoToCRM && (
                      <button
                        type="button"
                        onClick={onGoToCRM}
                        className="text-[10px] text-emerald-600 font-semibold underline"
                      >
                        Ver en CRM
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PropertyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        propertyToEdit={editingProperty}
        contacts={contacts}
        onSave={handleSaveProperty}
      />
    </div>
  );
}

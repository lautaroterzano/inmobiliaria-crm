"use client";

import React, { useState } from "react";
import { Check, Plus, UserCheck, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentColor, AgentProfile } from "@/lib/supabase";

interface AgentSwitcherModalProps {
  open: boolean;
  agents: AgentProfile[];
  activeAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
  onAddAgent: (newAgent: AgentProfile) => Promise<void>;
  onClose: () => void;
}

const COLOR_OPTIONS: { id: AgentColor; label: string; dotClass: string }[] = [
  { id: "emerald", label: "Esmeralda", dotClass: "bg-emerald-500" },
  { id: "violet", label: "Violeta", dotClass: "bg-violet-500" },
  { id: "blue", label: "Azul", dotClass: "bg-blue-500" },
  { id: "amber", label: "Ámbar", dotClass: "bg-amber-500" },
  { id: "rose", label: "Rosa", dotClass: "bg-rose-500" },
];

export function getAgentColorClasses(color: AgentColor = "emerald") {
  switch (color) {
    case "violet":
      return {
        bg: "bg-violet-500",
        softBg: "bg-violet-50 dark:bg-violet-950/40",
        text: "text-violet-700 dark:text-violet-300",
        border: "border-violet-200 dark:border-violet-800/70",
      };
    case "blue":
      return {
        bg: "bg-blue-500",
        softBg: "bg-blue-50 dark:bg-blue-950/40",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-800/70",
      };
    case "amber":
      return {
        bg: "bg-amber-500",
        softBg: "bg-amber-50 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800/70",
      };
    case "rose":
      return {
        bg: "bg-rose-500",
        softBg: "bg-rose-50 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-800/70",
      };
    default:
      return {
        bg: "bg-emerald-500",
        softBg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800/70",
      };
  }
}

export function AgentSwitcherModal({
  open,
  agents,
  activeAgent,
  onSelectAgent,
  onAddAgent,
  onClose,
}: AgentSwitcherModalProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<AgentColor>("violet");
  const [adding, setAdding] = useState(false);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || adding) return;

    setAdding(true);
    try {
      const slug =
        trimmed
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `agente-${Date.now()}`;

      const uniqueId = agents.some((a) => a.id === slug)
        ? `${slug}-${Date.now().toString().slice(-3)}`
        : slug;

      const created: AgentProfile = {
        id: uniqueId,
        name: trimmed,
        color: newColor,
      };

      await onAddAgent(created);
      setNewName("");
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                ¿Quién está usando la App?
              </h2>
              <p className="text-[11px] text-zinc-500">
                Elegí tu perfil de agente o sumá a alguien del equipo
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

        {/* Lista de agentes actuales */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Agentes del equipo:
          </p>
          {agents.map((ag) => {
            const isSelected = ag.id === activeAgent.id;
            const c = getAgentColorClasses(ag.color);
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => {
                  onSelectAgent(ag);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-8 w-8 rounded-full ${c.bg} text-white font-bold text-xs flex items-center justify-center shadow-xs`}
                  >
                    {ag.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">
                      {ag.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {isSelected ? "Perfil activo en este celular" : "Tocar para activar"}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                    <UserCheck className="h-3 w-3" />
                    <span>Activa</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Agregar nueva agente */}
        <form
          onSubmit={handleCreate}
          className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3"
        >
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            + Sumar nueva agente al equipo
          </p>

          <div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre (ej: Camila, Sofía, Martu...)"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Color distintivo:</span>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setNewColor(col.id)}
                  title={col.label}
                  className={`h-6 w-6 rounded-full ${col.dotClass} flex items-center justify-center transition-transform ${
                    newColor === col.id
                      ? "scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {newColor === col.id && (
                    <Check className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!newName.trim() || adding}
            className="w-full h-10 rounded-xl text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Crear y usar este perfil</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

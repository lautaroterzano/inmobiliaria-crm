"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Building2,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAgency, joinAgency, type Agency } from "@/lib/supabase";

interface AgencyOnboardingProps {
  displayName: string;
  email?: string;
  initialError?: string | null;
  onReady: (agency: Agency) => void;
  onLogout: () => void;
}

/**
 * Pantalla que ve un usuario logueado que todavía NO pertenece a ninguna inmobiliaria.
 * Sin crear una o sin un código de invitación válido no puede ver ningún dato.
 */
export function AgencyOnboarding({
  displayName,
  email,
  initialError,
  onReady,
  onLogout,
}: AgencyOnboardingProps) {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState(displayName);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const agency =
        mode === "join"
          ? await joinAgency(code, name.trim() || displayName)
          : await createAgency(agencyName, name.trim() || displayName);
      onReady(agency);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none";

  return (
    <div className="flex flex-col justify-center min-h-[100dvh] max-w-md mx-auto bg-slate-50 dark:bg-zinc-950 px-5 py-8 border-x border-zinc-200/70 dark:border-zinc-800/70">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 shadow-xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
            Tu inmobiliaria
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {email ? `Ingresaste como ${email}. ` : ""}
            Para ver contactos y planes tenés que unirte al equipo de tu
            inmobiliaria con el código que te pasaron, o crear una nueva.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90">
          <button
            type="button"
            onClick={() => {
              setMode("join");
              setErrorMsg(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mode === "join"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Tengo un código
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setErrorMsg(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mode === "create"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Crear inmobiliaria
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "join" ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Código de invitación
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: 7F3A9C21"
                maxLength={16}
                className={`${inputClass} font-mono tracking-widest uppercase`}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Nombre de la inmobiliaria
              </label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ej: Fiore Propiedades"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Tu nombre en el equipo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Fiorella"
              className={inputClass}
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={
              loading || (mode === "join" ? !code.trim() : !agencyName.trim())
            }
            className="w-full h-11 rounded-xl font-semibold"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "join" ? (
              "Unirme al equipo"
            ) : (
              "Crear mi inmobiliaria"
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-rose-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión / usar otra cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

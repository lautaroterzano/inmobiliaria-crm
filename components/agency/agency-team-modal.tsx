"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  Crown,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  listAgencyMembers,
  regenerateInviteCode,
  removeAgencyMember,
  type Agency,
  type AgencyMember,
} from "@/lib/supabase";

interface AgencyTeamModalProps {
  open: boolean;
  agency: Agency;
  currentUserId: string;
  isOwner: boolean;
  onAgencyChange: (agency: Agency) => void;
  onClose: () => void;
}

export function AgencyTeamModal({
  open,
  agency,
  currentUserId,
  isOwner,
  onAgencyChange,
  onClose,
}: AgencyTeamModalProps) {
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    listAgencyMembers().then((list) => {
      if (mounted) {
        setMembers(list);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    const text = `Unite a ${agency.name} en Agente Inmobiliario: ${
      typeof window !== "undefined" ? window.location.origin : ""
    }\nCódigo de invitación: ${agency.invite_code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRegenerate = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const code = await regenerateInviteCode();
      onAgencyChange({ ...agency, invite_code: code });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member: AgencyMember) => {
    if (busy) return;
    const label = member.display_name || member.email || "este miembro";
    if (!window.confirm(`¿Quitar a ${label} del equipo? Dejará de ver los datos.`))
      return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await removeAgencyMember(member.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                {agency.name}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Solo los miembros de este equipo ven sus contactos y planes
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

        {/* Código de invitación */}
        <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 space-y-2">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Código de invitación
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xl font-bold tracking-[0.25em] text-zinc-900 dark:text-white">
              {agency.invite_code}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={busy}
                  title="Generar un código nuevo (el anterior deja de funcionar)"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Nuevo
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Pasale este código a cada agente de tu inmobiliaria. Después de
            iniciar sesión con Google lo ingresa y entra a tu equipo.
          </p>
        </div>

        {/* Miembros */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Miembros del equipo
          </p>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            </div>
          ) : (
            members.map((m) => {
              const label = m.display_name || m.email || "Agente";
              const isMe = m.user_id === currentUserId;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {label.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1">
                        {label}
                        {isMe && (
                          <span className="text-[10px] font-medium text-zinc-400">
                            (vos)
                          </span>
                        )}
                        {m.role === "owner" && (
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </p>
                      {m.email && (
                        <p className="text-[11px] text-zinc-500 truncate">
                          {m.email}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOwner && !isMe && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m)}
                      disabled={busy}
                      title="Quitar del equipo"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}

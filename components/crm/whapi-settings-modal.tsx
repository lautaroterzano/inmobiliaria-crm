"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  LogOut,
  QrCode,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EvolutionStatusResult } from "@/lib/evolution";

interface WhapiSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onStatusChange?: (connected: boolean) => void;
}

export function WhapiSettingsModal({
  open,
  onClose,
  onStatusChange,
}: WhapiSettingsModalProps) {
  const [status, setStatus] = useState<EvolutionStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneInput, setPhoneInput] = useState("54911");
  const [copiedCode, setCopiedCode] = useState(false);

  const callStatusApi = async (params?: {
    fetchQr?: boolean;
    action?: "logout" | "pairingCode";
    phoneNumber?: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/whapi-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params || {}),
      });
      const data = (await res.json()) as EvolutionStatusResult;
      setStatus(data);
      onStatusChange?.(Boolean(data.connected));
    } catch {
      setStatus({
        configured: false,
        connected: false,
        instanceName: "fiorella",
        statusText: "Error de conexión",
      });
      onStatusChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      callStatusApi({ fetchQr: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleCopyPairingCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                Vincular WhatsApp
              </h2>
              <p className="text-[11px] text-zinc-500">
                Conexión directa para envíos automáticos del CRM
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

        {/* Estado actual */}
        <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {status?.connected ? (
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Wifi className="h-4 w-4" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                  <WifiOff className="h-4 w-4" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    Estado:
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      status?.connected
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {loading
                      ? "Verificando..."
                      : status?.connected
                      ? "Conectado y listo"
                      : status?.statusText || "Pendiente de vincular"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {status?.connected
                    ? "Los mensajes del CRM se envían desde el WhatsApp vinculado."
                    : "Podés vincular tu WhatsApp con código o QR."}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={loading}
              onClick={() => callStatusApi({ fetchQr: false })}
              title="Actualizar estado"
              className="h-8 w-8"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {status?.connected && (
            <div className="mt-3 pt-3 border-t border-zinc-200/70 dark:border-zinc-700/70 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => callStatusApi({ action: "logout" })}
                className="h-8 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Desvincular actual para conectar otro WhatsApp</span>
              </Button>
            </div>
          )}
        </div>

        {/* OPCIONES DE VINCULACIÓN CUANDO NO HAY WHATSAPP CONECTADO */}
        {!status?.connected && (
          <div className="mt-4 space-y-4">
            {/* OPCIÓN 1: DESDE EL MISMO CELULAR DE FIORELLA (CÓDIGO DE 8 DÍGITOS) */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Smartphone className="h-4 w-4" />
                <span>Opción 1: Vincular desde el propio celular (sin QR)</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Poné tu número (`54911...`), tocá{" "}
                <strong>Obtener Código</strong> y pegalo en{" "}
                <em>
                  WhatsApp → Dispositivos vinculados → Vincular con el número de
                  teléfono
                </em>
                .
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="54911xxxxxxxx"
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={loading || phoneInput.trim().length < 10}
                  onClick={() =>
                    callStatusApi({
                      action: "pairingCode",
                      phoneNumber: phoneInput.trim(),
                    })
                  }
                  className="h-9 px-3 text-xs font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Obtener Código</span>
                  )}
                </Button>
              </div>

              {status?.pairingCode && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/50 px-3.5 py-2.5">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                      Código para pegar en WhatsApp:
                    </span>
                    <span className="text-lg font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                      {status.pairingCode}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPairingCode(status.pairingCode!)}
                    className="h-8 text-xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar código</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* OPCIÓN 2: ESCANEAR QR DESDE OTRA PANTALLA */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => callStatusApi({ fetchQr: true })}
                className="w-full h-9 rounded-xl text-xs"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Opción 2: Mostrar Código QR en pantalla</span>
              </Button>

              {status?.qrBase64 && (
                <div className="flex flex-col items-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 text-center">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    Escaneá este QR desde el WhatsApp de Fiorella
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={status.qrBase64}
                    alt="Código QR de WhatsApp"
                    className="h-48 w-48 rounded-xl bg-white p-2 shadow-md"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {status?.error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 text-center">
            Detalle: {status.error}
          </p>
        )}
      </div>
    </div>
  );
}

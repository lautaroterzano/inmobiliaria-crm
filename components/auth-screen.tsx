"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setErrorMsg("Supabase no está configurado.");
      return;
    }
    setLoadingGoogle(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        setErrorMsg(
          error.message.includes("provider is not enabled")
            ? "Para usar el botón de Google, activá 'Google' en tu panel de Supabase (Authentication → Providers → Google), o ingresá abajo con tu Email y contraseña."
            : error.message
        );
        setLoadingGoogle(false);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al iniciar con Google"
      );
      setLoadingGoogle(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim() || !password.trim()) return;

    setLoadingEmail(true);
    setErrorMsg(null);

    try {
      if (mode === "register") {
        const displayName =
          fullName.trim() || email.trim().split("@")[0] || "Agente";
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: displayName,
              name: displayName,
            },
          },
        });
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        // Si Supabase tiene confirmación de email activada pero no inició sesión directo, intentamos login
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
          if (signInErr) {
            setErrorMsg(
              "Cuenta creada. Si no entra directo, revisá tu correo para confirmar o desactivá 'Confirm email' en Supabase → Authentication → Providers → Email."
            );
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) {
          setErrorMsg(
            error.message === "Invalid login credentials"
              ? "Email o contraseña incorrectos. Si es tu primera vez, tocá 'Crear cuenta' abajo."
              : error.message
          );
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error de autenticación"
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-[100dvh] max-w-md mx-auto bg-slate-50 dark:bg-zinc-950 px-5 py-8 border-x border-zinc-200/70 dark:border-zinc-800/70">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 shadow-xl space-y-5">
        {/* Logo y Título */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md mb-3">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
            Agente Inmobiliario
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Iniciá sesión con tu cuenta personal de agente inmobiliario
          </p>
        </div>

        {/* Botón Principal: Login con Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle || loadingEmail}
          className="w-full h-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {loadingGoogle ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span>Continuar con Google</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
          <span className="flex-shrink mx-3 text-[11px] text-zinc-400 uppercase tracking-wider">
            o con tu email
          </span>
          <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
        </div>

        {/* Formulario Email + Contraseña */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tu Nombre (aparecerá en tus plantillas de WhatsApp)
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Fiorella / Camila"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@gmail.com"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loadingEmail || loadingGoogle}
            className="w-full h-11 rounded-xl font-semibold"
          >
            {loadingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Ingresar a mi cuenta"
            ) : (
              "Crear mi cuenta de Agente"
            )}
          </Button>
        </form>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErrorMsg(null);
            }}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {mode === "login"
              ? "¿Primera vez? Creá tu cuenta de agente acá →"
              : "¿Ya tenés cuenta? Iniciá sesión acá →"}
          </button>
        </div>
      </div>
    </div>
  );
}

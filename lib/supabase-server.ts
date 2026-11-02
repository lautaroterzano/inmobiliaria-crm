import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Crea un cliente de Supabase "en nombre del usuario" a partir del header
 * `Authorization: Bearer <access_token>` del request. Así las consultas del
 * servidor respetan las políticas RLS de la inmobiliaria (tenant) del usuario.
 * Devuelve null si no hay token válido.
 */
export async function getSupabaseForRequest(
  req: Request
): Promise<{ client: SupabaseClient; user: User } | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  return { client, user: data.user };
}

export const isServerSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

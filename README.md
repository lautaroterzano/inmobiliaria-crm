# Fiore Copilot — Copiloto Inmobiliario Mobile-First (CABA)

Aplicación web **PWA / Mobile-First** diseñada para **Fiorella**, agente inmobiliaria en CABA, impulsada por **Next.js 14 (App Router)**, **Vercel AI SDK**, **Google Gemini (`gemini-2.0-flash`)**, **Tailwind CSS** y **Supabase**.

## 🚀 Puesta en marcha

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copiá el archivo `.env.example` a `.env.local` y completá tus claves:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_de_google_ai_studio
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```

3. **Configurar base de datos en Supabase:**
   Ejecutá el script [`supabase/schema.sql`](./supabase/schema.sql) en el **SQL Editor** de tu proyecto de Supabase para crear la tabla `fiore_messages` con soporte de historial. *(Nota: si aún no configuraste Supabase, la app guarda automáticamente el historial en `localStorage` como respaldo).*

4. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abrí `http://localhost:3000` desde el navegador o desde tu celular en la misma red.

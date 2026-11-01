import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente Inmobiliario | Asistente & CRM CABA",
  description:
    "Asistente móvil de marketing, Reels, TikTok, WhatsApp y Mini CRM para agentes inmobiliarios en CABA.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agente Inmobiliario",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-emerald-500/20">
        {children}
      </body>
    </html>
  );
}

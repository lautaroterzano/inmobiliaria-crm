import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agente Inmobiliario — Asistente & CRM CABA",
    short_name: "Agente Inmobiliario",
    description:
      "Asistente conversacional de marketing, redes sociales y Mini CRM para agentes inmobiliarios en CABA",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#059669",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

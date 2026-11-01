import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { agentName, sellers, recentMessages } = await req.json();

    const sellersText =
      Array.isArray(sellers) && sellers.length > 0
        ? sellers
            .map(
              (s: { name: string; stage: string; notes?: string }) =>
                `- Vendedor: ${s.name} | Etapa CRM: ${s.stage} | Detalle: ${s.notes || 'Sin notas'}`
            )
            .join('\n')
        : 'Sin vendedores cargados aún.';

    const chatText =
      Array.isArray(recentMessages) && recentMessages.length > 0
        ? recentMessages
            .slice(-6)
            .map(
              (m: { role: string; content: string }) =>
                `${m.role === 'user' ? agentName : 'Asistente'}: ${m.content.slice(0, 350)}`
            )
            .join('\n')
        : 'Sin conversaciones recientes.';

    const prompt = `
Actuá como el Director de Marketing de ${agentName || 'Fiorella'} en CABA.
Basándote en el estado actual de sus contactos VENDEDORES en el CRM y en sus últimas conversaciones con el Asistente, generá 3 acciones concretas y accionables para actualizar su Plan de Marketing semanal.

VENDEDORES EN CRM:
${sellersText}

ÚLTIMAS CONVERSACIONES CON EL ASISTENTE:
${chatText}

Respondé ÚNICAMENTE con un JSON válido (un array de objetos, sin bloques markdown \`\`\`json) con esta estructura exacta:
[
  {
    "title": "Título corto y claro de la publicación",
    "day_time": "Día y hora ideal en CABA (ej: Martes • 19:00 hs)",
    "format": "video_primera_persona" | "carrusel" | "estados_whatsapp" | "historia_backstage",
    "pillar": "Propiedades" | "Educación" | "Backstage" | "WhatsApp",
    "strategy_content": "Guion corto en voseo porteño con gancho 0-3s, indicación de si conviene video en 1ra persona o carrusel, y copy listo para copiar."
  }
]
`;

    const { text } = await generateText({
      model: google('gemini-flash-latest'),
      prompt,
    });

    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ ok: true, items: Array.isArray(parsed) ? parsed : [] });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Error al sincronizar plan con IA',
      },
      { status: 500 }
    );
  }
}

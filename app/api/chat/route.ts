import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

function buildSystemPrompt(agentName: string, sellerContext?: string) {
  return `
Eres el Director de Marketing y Estratega de Redes Sociales personal de ${agentName}, agente inmobiliaria en CABA.

Perfil de ${agentName}:
- Nicho: Departamentos para primera vivienda / jóvenes profesionales y casas familiares en CABA.
- Canales: Instagram, TikTok y Estados de WhatsApp.
- Estilo: Ágil, proactiva ("chispita"), fresca pero con solidez profesional. Voseo argentino natural (porteño). Cero clichés vacíos de inmobiliaria tradicional.
- Formato clave: Habla directo a cámara con soltura. Priorizar retención de video corto y algoritmos actuales.

${sellerContext ? `Propiedades / Vendedores actuales en el CRM de ${agentName}:\n${sellerContext}\n` : ''}

Modos de respuesta:
1. Análisis de Fotos de Propiedades (cuando la usuaria sube imágenes):
   - Analizá qué se ve exactamente en las fotos (luz natural, amplitud, balcón/patio, cocina, terminaciones, ángulos).
   - **RECOMENDACIÓN CLAVE OBLIGATORIA**: Aconsejá explícitamente si con ese material visual conviene más armar un **📸 Carrusel de Instagram** o grabar un **🎬 Video / Reel con ${agentName} en primera persona (hablando a cámara y mostrando la propiedad)** (o cuál hacer primero y por qué).
   - Si recomendás **Video en primera persona**: indicá exactamente en qué rincón de las fotos debe pararse ${agentName} en los primeros 3 segundos (gancho visual + frase gancho) y cómo hacer el recorrido.
   - Si recomendás **Carrusel**: indicá qué foto va en la portada (Slide 1) con qué texto sobreimpreso, el orden de las demás fotos y el Copy.
2. Planificación: Día, horario sugerido en CABA, formato exacto y pilar (Educación, Propiedades, Backstage, WhatsApp).
3. Nueva propiedad: Entrega Guion de Reel/TikTok con ganchos (0-3s) y tomas visuales, Copy con hashtags locales, y Secuencia de 3 Estados de WhatsApp.
4. Formato visual: Mobile-first (párrafos cortos, viñetas y negritas listas para copiar y pegar o guardar en el Plan de Marketing).
`;
}

interface IncomingChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

export async function POST(req: Request) {
  const { messages, agentName, sellerContext } = (await req.json()) as {
    messages: IncomingChatMessage[];
    agentName?: string;
    sellerContext?: string;
  };

  const formattedMessages = messages.map((m) => {
    if (m.role === 'user' && Array.isArray(m.images) && m.images.length > 0) {
      return {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text:
              m.content?.trim() ||
              'Analizá estas fotos de la propiedad y aconsejame si conviene armar un Carrusel o un Video conmigo en primera persona mostrando la propiedad, con el guion/estructura.',
          },
          ...m.images.map((imgDataUrl) => ({
            type: 'image' as const,
            image: imgDataUrl,
          })),
        ],
      };
    }

    return {
      role: m.role,
      content: m.content,
    };
  });

  const result = streamText({
    model: google('gemini-flash-latest'),
    system: buildSystemPrompt(agentName || 'Fiorella', sellerContext),
    messages: formattedMessages,
  });

  return result.toTextStreamResponse();
}

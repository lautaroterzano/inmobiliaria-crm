import { NextResponse } from "next/server";
import {
  getSupabaseForRequest,
  isServerSupabaseConfigured,
} from "@/lib/supabase-server";
import {
  renderWhatsAppTemplate,
  sendEvolutionTextMessage,
  type TemplateType,
} from "@/lib/evolution";

export async function POST(req: Request) {
  try {
    // Solo usuarios logueados pueden enviar WhatsApp; las consultas respetan RLS (su inmobiliaria)
    const auth = await getSupabaseForRequest(req);
    if (isServerSupabaseConfigured && !auth) {
      return NextResponse.json(
        { ok: false, error: "No autorizado. Volvé a iniciar sesión." },
        { status: 401 }
      );
    }
    const supabase = auth?.client ?? null;

    const body = await req.json();
    const {
      contactId,
      templateType,
      customMessage,
      phone: fallbackPhone,
      name: fallbackName,
    } = body as {
      contactId: string;
      templateType: TemplateType;
      customMessage?: string;
      phone?: string;
      name?: string;
    };

    if (!contactId && !fallbackPhone) {
      return NextResponse.json(
        { ok: false, error: "Falta contactId o teléfono del destinatario." },
        { status: 400 }
      );
    }

    let contactPhone = fallbackPhone || "";
    let contactName = fallbackName || "Hola";

    if (supabase && contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .eq("id", contactId)
        .maybeSingle();

      if (contact) {
        contactPhone = contact.phone;
        contactName = contact.name;
      }
    }

    if (!contactPhone) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se encontró el teléfono del contacto.",
        },
        { status: 404 }
      );
    }

    const messageText =
      customMessage && customMessage.trim().length > 0
        ? customMessage.trim()
        : renderWhatsAppTemplate(
            templateType || "buyer_seguimiento",
            contactName
          );

    const sendResult = await sendEvolutionTextMessage({
      to: contactPhone,
      body: messageText,
    });

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: sendResult.error,
          details: sendResult.raw,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    if (supabase && contactId) {
      await supabase
        .from("contacts")
        .update({ last_message_sent_at: nowIso })
        .eq("id", contactId);
    }

    return NextResponse.json({
      ok: true,
      sentAt: nowIso,
      messageId: sendResult.messageId,
      sentText: messageText,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Error interno al enviar WhatsApp por Evolution API",
      },
      { status: 500 }
    );
  }
}

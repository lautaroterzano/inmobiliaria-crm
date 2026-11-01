import { NextResponse } from "next/server";
import { checkEvolutionInstanceStatus } from "@/lib/evolution";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { fetchQr, action, phoneNumber } = body as {
      fetchQr?: boolean;
      action?: "logout" | "pairingCode";
      phoneNumber?: string;
    };

    const status = await checkEvolutionInstanceStatus({
      fetchQr: Boolean(fetchQr),
      action,
      phoneNumber,
    });

    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        instanceName: "fiorella",
        statusText: "Error al verificar instancia de WhatsApp",
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const status = await checkEvolutionInstanceStatus({ fetchQr: false });
  return NextResponse.json(status);
}

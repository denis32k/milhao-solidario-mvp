import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Webhook Mercado Pago carregado.",
  });
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "Webhook Mercado Pago recebeu uma notificação.",
  });
}
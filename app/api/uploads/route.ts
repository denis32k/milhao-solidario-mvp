import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { validateImageFile } from "@/lib/content-validation";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { ok: false, message: "Envie uma imagem válida." },
        { status: 400 }
      );
    }

    const validation = validateImageFile(file);
    if (!validation.ok || !validation.extension) {
      return NextResponse.json(
        { ok: false, message: validation.message },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}-${randomUUID()}.${validation.extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filepath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filepath, Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      url: `/uploads/${filename}`,
      filename,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao enviar imagem.",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

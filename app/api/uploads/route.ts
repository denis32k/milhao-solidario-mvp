import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Envie uma imagem válida." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { ok: false, message: "Formato inválido. Use JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, message: "Imagem muito grande. Envie até 5MB." },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
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

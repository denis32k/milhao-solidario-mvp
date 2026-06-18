import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type UploadFileRouteProps = {
  params: Promise<{ filename: string }>;
};

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function getContentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "application/octet-stream";
}

export async function GET(_request: Request, { params }: UploadFileRouteProps) {
  try {
    const { filename } = await params;
    const safeFilename = path.basename(String(filename || ""));

    if (!safeFilename || safeFilename !== filename) {
      return NextResponse.json({ ok: false, message: "Arquivo inválido." }, { status: 400 });
    }

    const filepath = path.join(getUploadDir(), safeFilename);
    const file = await readFile(filepath);

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": getContentType(safeFilename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Imagem não encontrada." }, { status: 404 });
  }
}

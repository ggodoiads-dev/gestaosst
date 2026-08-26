import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import { getCurrentUser } from "@/server/auth/current-user";

const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local";
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage/uploads";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { path: segments } = await params;
  const safeSegments = segments.filter((s) => s !== ".." && s !== ".");

  if (STORAGE_DRIVER === "blob") {
    const relativePath = safeSegments.join("/");
    const result = await get(relativePath, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: { "Content-Type": result.blob.contentType, "Cache-Control": "private, max-age=31536000" },
    });
  }

  // turbopackIgnore: caminho de storage local configurável em runtime (fora do bundle de build)
  const baseDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), STORAGE_DIR);
  const filePath = path.join(/*turbopackIgnore: true*/ baseDir, ...safeSegments);

  if (!filePath.startsWith(baseDir)) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=31536000" },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
}

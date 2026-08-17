const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Redimensiona/comprime uma foto no navegador antes do upload. Fotos de câmera de
 * celular costumam vir com vários MB (3000-4000px de lado) — sem isso, tanto o
 * upload quanto a chamada de visão computacional (que envia a imagem em base64 pra
 * IA) ficam lentos por causa do tamanho do arquivo, não da rede em si.
 * Best-effort: se a compressão falhar por qualquer motivo (API indisponível, decode
 * error), retorna o arquivo original — nunca bloqueia o anexo por causa disso.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1.5 * 1024 * 1024) {
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    const compressedName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], compressedName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

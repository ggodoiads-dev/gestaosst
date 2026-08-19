import "server-only";
import JSZip from "jszip";

/** Extrai o primeiro arquivo .txt de dentro de um .zip (usado pro AEJ, que vem compactado junto
 * com a assinatura digital .p7s — só o .txt interessa pra leitura). */
export async function extractFirstTextFile(buffer: Buffer): Promise<{ filename: string; content: string } | null> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".txt"));
  if (!entry) return null;
  const content = await entry.async("string");
  return { filename: entry.name, content };
}

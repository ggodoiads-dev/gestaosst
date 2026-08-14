import "server-only";
import QRCode from "qrcode";

/** Gera o QR Code (data URL) apontando para a rota pública de resolução do equipamento (seção 24). */
export async function generateEquipmentQrCode(qrToken: string, baseUrl: string): Promise<string> {
  const url = `${baseUrl}/q/${qrToken}`;
  return QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#1a1d23", light: "#ffffff" } });
}

/** Gera o QR Code (data URL) de rastreabilidade de um item de EPI entregue, mesma rota `/q/[token]`. */
export async function generateEpiDeliveryQrCode(qrToken: string, baseUrl: string): Promise<string> {
  const url = `${baseUrl}/q/${qrToken}`;
  return QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: "#1a1d23", light: "#ffffff" } });
}

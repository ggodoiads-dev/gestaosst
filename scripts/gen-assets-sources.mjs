import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("assets", { recursive: true });
const BRAND = "#001840";

// selo circular ocupa aproximadamente o quadrado esquerdo do wordmark (817x265)
const markCrop = { left: 0, top: 0, width: 265, height: 265 };

await sharp("public/sigo-logo.png")
  .extract(markCrop)
  .resize(900, 900, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 62, bottom: 62, left: 62, right: 62, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("assets/icon-only.png");

// foreground do ícone adaptativo: mesmo selo, com padding pra zona segura (~66%)
await sharp("public/sigo-logo.png")
  .extract(markCrop)
  .resize(680, 680, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 172, bottom: 172, left: 172, right: 172, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("assets/icon-foreground.png");

await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BRAND } })
  .png()
  .toFile("assets/icon-background.png");

const logo = await sharp("public/sigo-logo.png").resize(1600).toBuffer();
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BRAND } })
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile("assets/splash.png");

console.log("done");

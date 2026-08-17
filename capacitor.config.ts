import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.log20.sigo",
  appName: "SIGO",
  webDir: "www",
  server: {
    url: "https://gestaosst.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;

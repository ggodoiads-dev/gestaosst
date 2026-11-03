import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter_Tight, Instrument_Serif } from "next/font/google";
import { getUiTheme } from "@/lib/ui-theme";
import { Toaster } from "sonner";
import { GlobalActivityIndicator } from "@/components/layout/global-activity-indicator";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const interTight = Inter_Tight({ variable: "--font-tight", subsets: ["latin"], weight: "variable", display: "swap" });
const instrumentSerif = Instrument_Serif({ variable: "--font-serif-accent", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: "SIGO — Sistema Interno de Gestão Organizacional",
  authors: [{ name: "Gustavo Felipe Godoi" }],
  creator: "Gustavo Felipe Godoi",
  other: { copyright: "© 2026 Gustavo Felipe Godoi. Todos os direitos reservados." },
  description:
    "Segurança do trabalho, equipamentos, RH e demais módulos de gestão interna em um único sistema.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const ui = await getUiTheme();
  return (
    <html lang="pt-BR" data-ui={ui} className={`${plexSans.variable} ${interTight.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <GlobalActivityIndicator />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}

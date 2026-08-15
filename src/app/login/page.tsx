import type { Metadata } from "next";
import { Suspense } from "react";
import { SigoWordmark } from "@/components/domain/sigo-wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — SIGO · Sistema Interno de Gestão Organizacional",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-brand px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <SigoWordmark size="lg" className="items-center" />
        </div>

        <div className="rounded-lg border border-border bg-surface p-7 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-foreground-subtle">
              Informe suas credenciais para acessar o sistema.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-white/45">Acesso restrito a colaboradores autorizados.</p>
      </div>
    </div>
  );
}

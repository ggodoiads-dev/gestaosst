import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import Link from "next/link";
import { SIGO_COPYRIGHT_LINE } from "@/lib/legal";

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
        <div className="mb-7 flex flex-col items-center gap-2.5 text-center">
          <Image src="/sigo-logo.png" alt="SIGO" width={196} height={64} priority />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Sistema Interno de Gestão Organizacional
          </p>
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
        <p className="mt-2 text-center text-[11px] leading-relaxed text-white/40">
          {SIGO_COPYRIGHT_LINE}
          <br />
          Ao acessar, você concorda com os{" "}
          <Link href="/termos" className="underline underline-offset-2 hover:text-white/70">
            Termos de Uso e Licença
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

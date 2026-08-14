import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Log 20 · Gestão de SST e Equipamentos",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand px-14 py-12 text-white">
        <Image src="/log20-wordmark.png" alt="Log 20 Logística" width={220} height={87} priority />
        <div>
          <h1 className="text-3xl font-semibold leading-snug max-w-md">
            Sistema de Gestão de SST e Equipamentos
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/75 leading-relaxed">
            Checklists de equipamentos, manutenção, não conformidades, acidentes, qualificações,
            atividades e colaboradores, com rastreabilidade completa do início ao fim.
          </p>
        </div>
        <div className="text-xs text-white/50">
          Acesso restrito a colaboradores autorizados.
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-foreground-subtle">
              Informe suas credenciais para acessar o sistema.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

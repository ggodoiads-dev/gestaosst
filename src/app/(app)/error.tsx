"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isForbidden = /permissão|autenticado|Forbidden|Unauthorized/i.test(error.message);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      {isForbidden ? (
        <ShieldAlert className="size-10 text-warning" />
      ) : (
        <TriangleAlert className="size-10 text-danger" />
      )}
      <div>
        <h1 className="text-base font-semibold text-foreground">
          {isForbidden ? "Acesso não permitido" : "Não foi possível carregar esta página"}
        </h1>
        <p className="mt-1 max-w-sm text-sm text-foreground-subtle">
          {isForbidden
            ? "Você não tem permissão para acessar este recurso. Se acredita que deveria ter acesso, procure o administrador do sistema."
            : "Ocorreu um erro inesperado. Tente novamente ou volte para o início."}
        </p>
      </div>
      <div className="flex gap-2">
        {!isForbidden && (
          <Button variant="secondary" onClick={reset}>
            Tentar novamente
          </Button>
        )}
        <Button asChild>
          <Link href="/inicio">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}

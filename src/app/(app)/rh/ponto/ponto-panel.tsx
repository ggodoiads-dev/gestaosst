"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { uploadTimeClockFileAction } from "@/server/actions/time-clock.actions";
import type { TimeClockImportSummary } from "@/server/services/time-clock.service";

export function PontoPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TimeClockImportSummary | null>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Selecione um arquivo.");
      return;
    }
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      const res = await uploadTimeClockFileAction(formData);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setSummary(res.summary);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar arquivo do relógio de ponto</CardTitle>
        <CardDescription>
          Aceita o arquivo AEJ (.zip) do relógio de ponto — identifica cada marcação direto pela
          matrícula já cadastrada no colaborador. Padrão Portaria 671/2021, Anexo IV.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input ref={fileInputRef} type="file" accept=".zip" className="text-sm" />
        {uploadError && <p className="text-sm text-danger">{uploadError}</p>}
        {summary && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
            <p className="flex items-center gap-1.5 text-foreground">
              <CheckCircle2 className="size-4 text-success" /> {summary.totalRecords} marcação(ões) lida(s),{" "}
              {summary.matched} identificada(s).
            </p>
            {summary.unmatched > 0 && (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle className="size-4 shrink-0 translate-y-0.5" />
                <span>
                  {summary.unmatched} marcação(ões) de {summary.unmatchedPis.length} colaborador(es) não
                  identificado(s). Vincule ou ignore cada código em{" "}
                  <Link href="/rh/tratativa-ponto" className="font-medium underline">
                    Tratativa de Ponto
                  </Link>
                  .
                </span>
              </p>
            )}
            {summary.ignoredLines > 0 && (
              <p className="text-xs text-foreground-subtle">
                {summary.ignoredLines} linha(s) do arquivo não reconhecida(s) e ignorada(s).
              </p>
            )}
            <Button asChild variant="secondary" size="sm" className="self-start mt-1">
              <Link href="/rh/tratativa-ponto">
                Ver Tratativa de Ponto <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpload} loading={uploading}>
          <Upload className="size-4" /> Enviar arquivo
        </Button>
      </CardFooter>
    </Card>
  );
}

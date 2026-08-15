import { redirect } from "next/navigation";

/** Conformidade de checklist virou uma seção de /indicadores (BI unificado) — mantém o link
 * antigo funcionando em vez de quebrar quem tinha essa URL salva. */
export default async function ChecklistConformidadeRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const sp = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined));
  const query = sp.toString();
  redirect(query ? `/indicadores?${query}` : "/indicadores");
}

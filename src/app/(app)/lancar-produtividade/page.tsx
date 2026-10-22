import { redirect } from "next/navigation";

/** O lançamento por pessoa agora fica na página de cada ajudante, em Produtividade dos Ajudantes. */
export default async function LancarProdutividadeRedirect({ searchParams }: { searchParams: Promise<{ collaboratorId?: string; period?: string; ref?: string }> }) {
  const { collaboratorId, period, ref } = await searchParams;
  if (!collaboratorId) redirect("/produtividade");
  const query = new URLSearchParams();
  if (period) query.set("period", period);
  if (ref) query.set("ref", ref);
  const qs = query.toString();
  redirect(`/produtividade/${collaboratorId}${qs ? `?${qs}` : ""}`);
}

import { requireUser } from "@/server/auth/current-user";
import { getCollaboratorDetail } from "@/server/services/collaborator.service";
import { listEpiDeliveriesForCollaborator } from "@/server/services/epi.service";
import { formatDate } from "@/lib/dates";
import { PrintButton } from "./print-button";

const REASON_LABELS: Record<string, string> = {
  PRIMEIRA_ENTREGA: "1",
  SUBSTITUICAO_DANO_JUSTIFICADO: "2",
  SUBSTITUICAO_DANO_PROPRIO_PERDA: "3",
  TROCA_DANIFICADO_VENCIDO: "4",
  DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO: "5",
};

export default async function FichaEpiImprimirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [collaborator, deliveries] = await Promise.all([
    getCollaboratorDetail(user, id),
    listEpiDeliveriesForCollaborator(user, id),
  ]);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <table className="w-full border-collapse border border-black text-xs">
        <tbody>
          <tr>
            <td className="border border-black p-2 align-top" colSpan={2}>
              <p className="font-semibold">LOG20 LOGÍSTICA S/A</p>
              <p>CNPJ 13.631.347.0011-56</p>
              <p>Rua: Francisco Otaviano nº 1030 — CEP 84070-360 — Bairro Nova Rússia — Ponta Grossa PR</p>
              <p>Filial Unidade Vidros Carambeí PR 151 km 312</p>
            </td>
            <td className="border border-black p-2 text-center align-middle font-bold" colSpan={2}>
              FICHA DE CONTROLE DE EPI
            </td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold" colSpan={2}>NOME DO COLABORADOR</td>
            <td className="border border-black p-2 font-semibold" colSpan={2}>CPF</td>
          </tr>
          <tr>
            <td className="border border-black p-2" colSpan={2}>{collaborator.name}</td>
            <td className="border border-black p-2" colSpan={2}>{collaborator.cpf ?? "-"}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">SETOR</td>
            <td className="border border-black p-2 font-semibold">FUNÇÃO</td>
            <td className="border border-black p-2 font-semibold" colSpan={2}>ADMISSÃO</td>
          </tr>
          <tr>
            <td className="border border-black p-2">{collaborator.area?.name ?? "-"}</td>
            <td className="border border-black p-2">{collaborator.cargo ?? "-"}</td>
            <td className="border border-black p-2" colSpan={2}>{formatDate(collaborator.admissionDate)}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold">CTPS</td>
            <td className="border border-black p-2 font-semibold">SÉRIE</td>
            <td className="border border-black p-2 font-semibold" colSpan={2}>DESLIGAMENTO</td>
          </tr>
          <tr>
            <td className="border border-black p-2">{collaborator.ctps ?? "-"}</td>
            <td className="border border-black p-2">{collaborator.ctpsSerie ?? "-"}</td>
            <td className="border border-black p-2" colSpan={2}>
              {collaborator.inactivatedAt ? formatDate(collaborator.inactivatedAt) : "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 space-y-2 text-[11px] leading-snug">
        <p>
          1- Recebi da empresa os Equipamentos de Proteção Individual (EPI) abaixo listados, nas datas
          ali registradas. Comprometo-me a utilizar os EPIs fornecidos na execução das minhas
          atividades, zelando pela guarda e conservação mantendo os mesmos em perfeito estado de
          utilização. Assumo o compromisso de devolvê-los quando for solicitado ou por rescisão de
          contrato de trabalho.
        </p>
        <p>
          2- Declaro ainda estar ciente de que o uso é obrigatório sob pena conforme Lei nº 6.514, de
          22/12/77, artigo 158. E nos termos do item 6.3, da NR-6: EPI, que regulamentou os artigos 166
          e 167 da CLT, onde a empresa fornece gratuitamente ao empregado abaixo identificado, para uso
          exclusivo em serviço, os seguintes Equipamentos de Proteção Individual descritos nesta ficha.
        </p>
        <p>
          3- Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência
          ou extravio a empresa fornecerá um novo equipamento e o valor será descontado do meu salário.
        </p>
        <p>4- Declaro que os equipamentos recebidos estão em plenas condições de uso.</p>
      </div>

      <div className="mt-4 flex items-end justify-between text-xs">
        <div>
          <p className="border-b border-black px-6 pb-1">{formatDate(new Date())}</p>
          <p className="mt-1">DATA</p>
        </div>
        <div className="text-center">
          <p className="border-b border-black px-16 pb-1">&nbsp;</p>
          <p className="mt-1">{collaborator.name}</p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse border border-black text-[11px]">
        <thead>
          <tr>
            <th className="border border-black p-1">QTD</th>
            <th className="border border-black p-1">DESCRIÇÃO DO EPI</th>
            <th className="border border-black p-1">CA</th>
            <th className="border border-black p-1">MED</th>
            <th className="border border-black p-1">DATA ENTREGA</th>
            <th className="border border-black p-1">DATA DEVOLUÇÃO</th>
            <th className="border border-black p-1">ASSINATURA</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.length === 0 && (
            <tr>
              <td className="border border-black p-2 text-center" colSpan={7}>Nenhum EPI registrado.</td>
            </tr>
          )}
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td className="border border-black p-1 text-center">{delivery.quantity}</td>
              <td className="border border-black p-1">
                {delivery.epiType.name}
                {delivery.size ? ` Nº${delivery.size}` : ""}
              </td>
              <td className="border border-black p-1 text-center">{delivery.ca || "N/A"}</td>
              <td className="border border-black p-1 text-center">{REASON_LABELS[delivery.reason] ?? "-"}</td>
              <td className="border border-black p-1 text-center">{formatDate(delivery.deliveredAt)}</td>
              <td className="border border-black p-1 text-center">
                {delivery.returnedAt ? formatDate(delivery.returnedAt) : ""}
              </td>
              <td className="border border-black p-1"></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 text-[10px] leading-snug">
        <p className="font-semibold">LEGENDA: (MED) - MOTIVOS PARA ENTREGA E DEVOLUÇÃO</p>
        <p>
          (1). Primeira entrega, admissão / (2). Substituição por dano justificado / (3). Substituição
          por dano próprio ou perda / (4). Troca do EPI, danificado ou vencido / (5). Devolução,
          demissão ou mudança de função
        </p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}

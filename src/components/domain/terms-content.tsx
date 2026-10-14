import { SIGO_COPYRIGHT_LINE, SIGO_OWNER_NAME } from "@/lib/legal";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground-muted">{children}</div>
    </section>
  );
}

/** Texto dos Termos de Uso e Licença — usado na página pública (/termos) e dentro do sistema (/termos-de-uso). */
export function TermsContent() {
  return (
    <>
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground">
        O SIGO é um software protegido por direitos autorais. O acesso e o uso dependem de autorização do titular e seguem as
        condições abaixo.
      </p>

      <Section n={1} title="Titularidade">
        <p>
          O SIGO — incluindo seu código-fonte, estrutura de dados, telas, textos, regras de negócio, documentação, nome e identidade visual — é
          obra intelectual de <strong>{SIGO_OWNER_NAME}</strong>, titular exclusivo dos direitos autorais sobre o programa, nos termos da Lei nº
          9.609/1998 (Lei do Software) e da Lei nº 9.610/1998 (Lei de Direitos Autorais).
        </p>
        <p>{SIGO_COPYRIGHT_LINE}</p>
      </Section>

      <Section n={2} title="Licença de uso">
        <p>
          O titular concede à organização usuária autorizada uma licença de uso <strong>não exclusiva, intransferível, não sublicenciável e
          revogável</strong>, limitada ao ambiente, ao prazo e às condições acordados por escrito com o titular. Essa licença dá direito de
          <em> usar</em> o SIGO como serviço; <strong>não transfere</strong> a propriedade do software nem de qualquer parte dele.
        </p>
        <p>
          Sem autorização expressa do titular, nenhuma pessoa ou organização tem direito de usar, manter em funcionamento ou continuar
          utilizando o SIGO além do que foi autorizado.
        </p>
      </Section>

      <Section n={3} title="O que é proibido">
        <ul className="list-disc pl-5">
          <li>copiar, reproduzir, distribuir, vender, alugar, ceder ou sublicenciar o SIGO, no todo ou em parte;</li>
          <li>modificar, adaptar, traduzir ou criar obras derivadas a partir do SIGO;</li>
          <li>descompilar, desmontar ou fazer engenharia reversa, ou tentar obter o código-fonte ou a estrutura interna do sistema;</li>
          <li>extrair, copiar ou reaproveitar telas, regras, modelos, textos ou a estrutura do banco de dados para criar outro sistema;</li>
          <li>remover ou alterar avisos de direitos autorais, de titularidade ou de licença;</li>
          <li>contornar controles de acesso, tentar acessar áreas ou dados sem permissão, ou usar robôs e rotinas automáticas para coletar informações;</li>
          <li>compartilhar credenciais de acesso. Cada usuário é responsável pela guarda da sua senha e pelo que é feito com ela.</li>
        </ul>
      </Section>

      <Section n={4} title="Dados cadastrados">
        <p>
          Os dados inseridos pela organização usuária (colaboradores, checklists, ocorrências, documentos e demais registros) pertencem a ela.
          O titular do SIGO não adquire a propriedade desses dados. O tratamento de dados pessoais observa a Lei Geral de Proteção de Dados
          (Lei nº 13.709/2018), cabendo à organização usuária o papel de controladora dos dados que cadastra.
        </p>
        <p>
          O acesso é registrado (trilha de auditoria) para segurança do sistema e da própria organização.
        </p>
      </Section>

      <Section n={5} title="Disponibilidade e responsabilidade">
        <p>
          O SIGO é fornecido no estado em que se encontra, conforme o que for acordado em contrato. Salvo disposição contratual diferente, o
          titular não garante funcionamento ininterrupto nem ausência de erros, e não responde por decisões tomadas com base nas informações
          do sistema, que devem ser conferidas pelos responsáveis de cada processo.
        </p>
      </Section>

      <Section n={6} title="Suspensão e encerramento">
        <p>
          O titular pode suspender ou encerrar o acesso em caso de descumprimento destes termos, de uso não autorizado, ou de término ou
          falta de pagamento da licença acordada. Encerrada a licença, cessa o direito de uso do SIGO; os dados da organização usuária podem ser
          exportados nas condições definidas em contrato.
        </p>
      </Section>

      <Section n={7} title="Violação">
        <p>
          O uso, a cópia ou a reprodução não autorizados do SIGO configuram violação de direitos autorais e sujeitam o infrator às medidas
          civis e criminais previstas em lei, incluindo cessação do uso, indenização e responsabilização.
        </p>
      </Section>

      <Section n={8} title="Alterações e foro">
        <p>
          Estes termos podem ser atualizados; a versão em vigor é a publicada nesta página. Fica eleito o foro da comarca de domicílio do
          titular para resolver questões decorrentes deles, salvo o que for estabelecido em contrato de licença específico.
        </p>
        <p>Para tratar de licenciamento ou autorizações de uso, use o canal indicado no contrato ou procure diretamente o titular.</p>
      </Section>

    </>
  );
}

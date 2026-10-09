import { formatDate, formatDateTime } from "@/lib/dates";
import {
  CLASSIFICATION_LABELS,
  YES_NO_LABELS,
  type Classification,
  type EmployeeAnswers,
  type Evaluation,
} from "@/domain/absence-interview/form";

function dateFromKey(key: string | undefined | null) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d, 12));
}

function yn(v: "SIM" | "NAO" | undefined | null) {
  return v ? YES_NO_LABELS[v] : "—";
}

function Rows({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-xs text-foreground-subtle">{label}</dt>
          <dd className="text-sm font-medium text-foreground">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AnswersSummary({
  answers,
  filledByHr,
  answeredAt,
}: {
  answers: EmployeeAnswers;
  filledByHr: boolean;
  answeredAt: Date | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="text-xs text-foreground-subtle">O que aconteceu</span>
        <p className="whitespace-pre-wrap text-sm text-foreground">{answers.description}</p>
      </div>
      {answers.fiveWhys?.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-foreground-subtle">Os 5 porquês</span>
          <ol className="flex flex-col gap-1 text-sm text-foreground">
            {answers.fiveWhys.map((w, i) => (
              <li key={i}>
                <span className="text-foreground-subtle">{i + 1}. Por quê? </span>
                {w}
              </li>
            ))}
          </ol>
        </div>
      )}
      {answeredAt && (
        <p className="text-xs text-foreground-subtle">
          {filledByHr ? "Preenchido pelo RH em nome do colaborador" : "Respondido pelo próprio colaborador"} em{" "}
          {formatDateTime(answeredAt)}.
        </p>
      )}
    </div>
  );
}

export function EvaluationSummary({ evaluation, concludedBy, concludedAt }: { evaluation: Evaluation; concludedBy?: string | null; concludedAt: Date | null }) {
  return (
    <div className="flex flex-col gap-3">
      <Rows
        rows={[
          ["Início da ausência", dateFromKey(evaluation.startDate)],
          ["Fim da ausência", dateFromKey(evaluation.endDate)],
          ["Falta(s) anterior(es) sem justificativa", yn(evaluation.priorUnjustified)],
          ["Comunicação prévia à empresa", yn(evaluation.communicatedBefore)],
          ["Justificativa compatível apresentada", yn(evaluation.presentedJustification)],
          ["Classificação", CLASSIFICATION_LABELS[evaluation.classification as Classification]],
          ["Detalhe", evaluation.detail],
          ["Problema de saúde", evaluation.healthProblem],
          ["CRM / CRO", evaluation.crm],
          ["CID", evaluation.cid],
          ["Ação tomada", evaluation.actionTaken],
          ["Justificativa acatada pela empresa", yn(evaluation.excuseAccepted)],
          ["Dia descontado", yn(evaluation.dayDiscounted)],
          ["Poderia ser evitada com folga alinhada", yn(evaluation.avoidableByDayOff)],
        ]}
      />
      {evaluation.hrComments && <p className="text-sm text-foreground">Gente e Gestão: {evaluation.hrComments}</p>}
      {evaluation.leadershipComments && <p className="text-sm text-foreground">Liderança: {evaluation.leadershipComments}</p>}
      {concludedAt && (
        <p className="text-xs text-foreground-subtle">
          Concluída por {concludedBy ?? "—"} em {formatDateTime(concludedAt)}.
        </p>
      )}
    </div>
  );
}

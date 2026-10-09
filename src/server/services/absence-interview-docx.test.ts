import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildInterviewDocx } from "./absence-interview-docx";
import type { InterviewDetail } from "./absence-interview.service";

const interview = {
  id: "i1",
  answers: {
    startDate: "2026-10-08",
    endDate: "2026-10-08",
    priorUnjustified: "NAO",
    communicatedBefore: "SIM",
    presentedJustification: "SIM",
    reason: "Saúde - com atestado médico",
    healthProblem: "Febre",
    crm: "12345",
    cid: "0",
    description: "Estava com febre alta.",
    comments: null,
  },
  filledByHr: false,
  answeredAt: new Date("2026-10-09T12:00:00Z"),
  evaluation: {
    classification: "JUSTIFICADA",
    detail: "Saúde - com atestado Médico",
    actionTaken: "Não Aplicável",
    excuseAccepted: "SIM",
    dayDiscounted: "NAO",
    avoidableByDayOff: "NAO",
    fiveWhys: ["Febre", "Virose"],
    hrComments: "Ok",
    leadershipComments: null,
  },
  concludedAt: new Date("2026-10-09T13:00:00Z"),
  concludedBy: { name: "RH" },
  collaborator: { name: "FULANO DA SILVA", matricula: "123", area: { name: "Picking" }, function: { name: "Ajudante" } },
  note: { date: new Date("2026-10-08T12:00:00Z"), status: "ATESTADO" },
} as unknown as InterviewDetail;

describe("buildInterviewDocx", () => {
  it("gera um .docx (zip) com o conteúdo da entrevista", async () => {
    const buffer = await buildInterviewDocx(interview);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it("tolera entrevista sem relato nem avaliação", async () => {
    const buffer = await buildInterviewDocx({ ...interview, answers: null, evaluation: null, concludedAt: null, answeredAt: null } as unknown as InterviewDetail);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});

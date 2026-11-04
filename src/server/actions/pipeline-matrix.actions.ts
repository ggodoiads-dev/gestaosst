"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/pipeline-matrix.service";
import type { MatrixWorkbook, ParsedMatrix, SpecialistInput } from "@/server/services/pipeline-matrix.service";

export type MatrixResult = { ok: true; id?: string } | { ok: false; error: string };

const KNOWN = /Informe o|Escolha a|Escolha o|Nível inválido/;

async function run(fn: () => Promise<string | void>): Promise<MatrixResult> {
  try {
    const id = await fn();
    revalidatePath("/pipeline");
    return { ok: true, id: id || undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[pipeline-matriz] falha:", error);
    return { ok: false, error: "Não foi possível salvar. As tabelas da Matriz já foram criadas no banco?" };
  }
}

export async function createMatrixAction(name: string, skills: string[]): Promise<MatrixResult> {
  return run(async () => service.createMatrix(await requireUser(), name, skills));
}
export async function renameMatrixAction(id: string, name: string): Promise<MatrixResult> {
  return run(async () => service.renameMatrix(await requireUser(), id, name));
}
export async function deleteMatrixAction(id: string): Promise<MatrixResult> {
  return run(async () => service.deleteMatrix(await requireUser(), id));
}
export async function addSkillAction(matrixId: string, name: string): Promise<MatrixResult> {
  return run(async () => service.addSkill(await requireUser(), matrixId, name));
}
export async function deleteSkillAction(skillId: string): Promise<MatrixResult> {
  return run(async () => service.deleteSkill(await requireUser(), skillId));
}
export async function addMemberAction(matrixId: string, input: { collaboratorId?: string | null; name: string; role?: string | null; grp?: string | null }): Promise<MatrixResult> {
  return run(async () => service.addMember(await requireUser(), matrixId, input));
}
export async function updateMemberAction(memberId: string, input: { role?: string | null; grp?: string | null }): Promise<MatrixResult> {
  return run(async () => service.updateMember(await requireUser(), memberId, input));
}
export async function addMembersByFunctionAction(matrixId: string, functionName: string): Promise<MatrixResult & { count?: number }> {
  let count = 0;
  const res = await run(async () => {
    count = await service.addMembersByFunction(await requireUser(), matrixId, functionName);
  });
  return res.ok ? { ...res, count } : res;
}
export async function setRowLevelAction(memberId: string, level: number): Promise<MatrixResult> {
  return run(async () => service.setRowLevel(await requireUser(), memberId, level));
}
export async function linkNamesAction(): Promise<{ ok: true; linked: number; unmatched: string[] } | { ok: false; error: string }> {
  try {
    const result = await service.linkNamesToRegistry(await requireUser());
    revalidatePath("/pipeline");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[pipeline-matriz] falha ao ligar os nomes:", error);
    return { ok: false, error: "Não foi possível correlacionar os nomes." };
  }
}
export async function deleteMemberAction(memberId: string): Promise<MatrixResult> {
  return run(async () => service.deleteMember(await requireUser(), memberId));
}
/** Sem revalidar a página: a célula já mudou na tela; o recálculo da aderência é feito no cliente. */
export async function setLevelAction(memberId: string, skillId: string, level: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await service.setLevel(await requireUser(), memberId, skillId, level);
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[pipeline-matriz] falha ao salvar nível:", error);
    return { ok: false, error: "Não foi possível salvar o nível." };
  }
}

export async function saveSpecialistAction(id: string | null, input: SpecialistInput): Promise<MatrixResult> {
  return run(async () => service.saveSpecialist(await requireUser(), id, input));
}
export async function deleteSpecialistAction(id: string): Promise<MatrixResult> {
  return run(async () => service.deleteSpecialist(await requireUser(), id));
}

export type ReadMatrixResult = ({ ok: true } & MatrixWorkbook) | { ok: false; error: string };

export async function readMatrixWorkbookAction(formData: FormData): Promise<ReadMatrixResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione um arquivo .xlsx." };
    if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "Use a planilha em .xlsx." };
    return { ok: true, ...(await service.readMatrixWorkbook(user, Buffer.from(await file.arrayBuffer()))) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[pipeline-matriz] falha ao ler a planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Confira se é a planilha de gestão do pipeline (.xlsx)." };
  }
}

export type CommitMatrixResult = { ok: true; matricesSaved: number; membersSaved: number; specialistsSaved: number } | { ok: false; error: string };

export async function commitMatrixImportAction(input: { matrices: ParsedMatrix[]; specialists: SpecialistInput[]; replaceMatrices: boolean }): Promise<CommitMatrixResult> {
  try {
    const result = await service.commitMatrixImport(await requireUser(), input);
    revalidatePath("/pipeline");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[pipeline-matriz] falha ao importar:", error);
    return { ok: false, error: "Não foi possível importar. As tabelas da Matriz já foram criadas no banco?" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import * as shiftCheckInService from "@/server/services/shift-checkin.service";

export async function confirmMyShiftCheckInAction() {
  const user = await requireUser();
  await shiftCheckInService.confirmMyShiftCheckIn(user);
  revalidatePath("/minha-presenca");
}

export async function confirmShiftCheckInForAction(collaboratorId: string) {
  const user = await requireUser();
  await shiftCheckInService.confirmShiftCheckInFor(user, collaboratorId);
  revalidatePath(`/colaboradores/${collaboratorId}`);
}

export async function removeShiftCheckInForAction(collaboratorId: string) {
  const user = await requireUser();
  await shiftCheckInService.removeShiftCheckInFor(user, collaboratorId);
  revalidatePath(`/colaboradores/${collaboratorId}`);
}

import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export function listUnits() {
  return db.unit.findMany({ orderBy: { name: "asc" } });
}

export function listAreas() {
  return db.area.findMany({
    include: { unit: true },
    orderBy: [{ unit: { name: "asc" } }, { name: "asc" }],
  });
}

/** Referência simples pra formulários (ex: atribuir função a um líder em /usuarios) —
 * sem gate de permissão, igual `listAreas`/`listUnits`; quem chama já está numa tela protegida. */
export function listActiveJobFunctions() {
  return db.jobFunction.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function listEquipmentTypes() {
  return db.equipmentType.findMany({ orderBy: { name: "asc" } });
}

export function listFaultCategories() {
  return db.faultCategory.findMany({ orderBy: { name: "asc" } });
}

export async function createUnit(user: CurrentUser, data: { name: string; code: string }) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const unit = await db.unit.create({ data });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Unit", entityId: unit.id, newValue: data });
  return unit;
}

export async function updateUnit(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.unit.findUniqueOrThrow({ where: { id } });
  const unit = await db.unit.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Unit",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return unit;
}

export async function setUnitActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.unit.findUniqueOrThrow({ where: { id } });
  const unit = await db.unit.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Unit",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return unit;
}

export async function createArea(
  user: CurrentUser,
  data: { name: string; code: string; unitId: string; sector?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const area = await db.area.create({ data });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Area", entityId: area.id, newValue: data });
  return area;
}

export async function updateArea(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string; unitId: string; sector?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.area.findUniqueOrThrow({ where: { id } });
  const area = await db.area.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Area",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return area;
}

export async function setAreaActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.area.findUniqueOrThrow({ where: { id } });
  const area = await db.area.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Area",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return area;
}

export async function createEquipmentType(
  user: CurrentUser,
  data: { name: string; code: string; description?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const type = await db.equipmentType.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "EquipmentType",
    entityId: type.id,
    newValue: data,
  });
  return type;
}

export async function updateEquipmentType(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string; description?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.equipmentType.findUniqueOrThrow({ where: { id } });
  const type = await db.equipmentType.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "EquipmentType",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return type;
}

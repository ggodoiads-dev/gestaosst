import "dotenv/config";
import { db } from "../src/server/db";

/**
 * Migração única de dados: cria um JobFunction pra cada valor distinto já existente em
 * Collaborator.cargo (texto livre) e liga functionId de cada colaborador ao registro
 * correspondente. Idempotente — pode rodar mais de uma vez sem duplicar nada. Necessária
 * porque `cargo` virou um cadastro (JobFunction) pra suportar o kit de EPI automático por
 * função; colaboradores existentes não podem perder a função que já tinham.
 */
async function main() {
  const collaborators = await db.collaborator.findMany({
    where: { functionId: null, cargo: { not: null } },
    select: { id: true, cargo: true },
  });

  const cache = new Map<string, string>();
  let linked = 0;

  for (const collaborator of collaborators) {
    const name = collaborator.cargo?.trim();
    if (!name) continue;

    let jobFunctionId = cache.get(name);
    if (!jobFunctionId) {
      const jobFunction = await db.jobFunction.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      jobFunctionId = jobFunction.id;
      cache.set(name, jobFunctionId);
    }

    await db.collaborator.update({ where: { id: collaborator.id }, data: { functionId: jobFunctionId } });
    linked++;
  }

  console.log(`Funções criadas/reaproveitadas: ${cache.size}. Colaboradores vinculados: ${linked}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

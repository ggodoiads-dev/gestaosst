import { randomInt } from "node:crypto";

/** Remove acentos e caracteres especiais, deixando só letras/números/ponto (sem dependência de banco). */
function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove marcas diacríticas combinantes (acentos) deixadas pelo NFD
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(".")
    .replace(/[^a-z0-9.]/g, "");
}

/**
 * Gera um e-mail de login a partir do nome (ex: "João da Silva" -> "joao.da.silva@log20.local"),
 * resolvendo colisão anexando um número — não precisa ser um e-mail real, só um identificador
 * único de login para colaboradores que não têm e-mail corporativo.
 */
export function generateLoginEmail(name: string, existingEmails: Set<string>, domain = "log20.local"): string {
  const base = slugifyName(name) || "colaborador";
  let candidate = `${base}@${domain}`;
  let suffix = 2;
  while (existingEmails.has(candidate)) {
    candidate = `${base}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
}

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sem 0/O, 1/l/I

/** Senha aleatória de 8 caracteres, sem caracteres ambíguos, usando crypto (não Math.random). */
export function generatePassword(length = 8): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

import { randomInt } from "node:crypto";

/** Remove acentos e caracteres especiais, deixando só letras/números (sem dependência de banco). */
function slugifyWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove marcas diacríticas combinantes (acentos) deixadas pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Gera um e-mail de login a partir do primeiro nome (ex: "João da Silva" -> "joao@log20.com.br"),
 * resolvendo colisão anexando um número — não precisa ser um e-mail real (a maioria dos
 * colaboradores não tem e-mail corporativo próprio), só um identificador único de login fácil de
 * lembrar. Só o primeiro nome é usado de propósito — colisão é esperada e resolvida pelo sufixo.
 */
export function generateLoginEmail(name: string, existingEmails: Set<string>, domain = "log20.com.br"): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const base = slugifyWord(firstName) || "colaborador";
  let candidate = `${base}@${domain}`;
  let suffix = 2;
  while (existingEmails.has(candidate)) {
    candidate = `${base}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Senha padrão do primeiro acesso, igual pra todo mundo — usada só no provisionamento inicial
 * (nunca em redefinição, que sempre gera uma senha aleatória via `generatePassword`).
 */
export const DEFAULT_INITIAL_PASSWORD = "12345678";

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // sem 0/O, 1/l/I

/** Senha aleatória de 8 caracteres, sem caracteres ambíguos, usando crypto (não Math.random). */
export function generatePassword(length = 8): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

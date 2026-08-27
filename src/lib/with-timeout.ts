/**
 * Numa conexão lenta/instável (dado móvel), uma Server Action pode ficar pendurada sem nunca
 * resolver nem rejeitar — sem isso, o botão fica girando pra sempre e o usuário não sabe se
 * travou, se enviou, ou o que fazer. Depois do prazo, rejeita com `TIMEOUT_ERROR` pra quem
 * chamou mostrar um erro e liberar a ação pra tentar de novo (mesmo que a requisição original
 * ainda esteja em trânsito no servidor).
 */
export const TIMEOUT_ERROR = new Error("TIMEOUT");

export async function withTimeout<T>(promise: Promise<T>, ms = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(TIMEOUT_ERROR), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function connectionErrorMessage(error: unknown, fallback: string): string {
  if (error === TIMEOUT_ERROR) {
    return "Conexão lenta ou instável — não foi possível confirmar o envio. Verifique sua internet e tente novamente.";
  }
  return fallback;
}

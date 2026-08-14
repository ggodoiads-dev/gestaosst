import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/server/db";

const SESSION_COOKIE = "app_session";
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

/**
 * Verifica a assinatura do JWT e confirma no banco que o usuário ainda
 * existe e está ativo. Uma sessão com assinatura válida mas usuário
 * inexistente/inativo (ex.: banco recriado, usuário desativado) precisa ser
 * tratada como não autenticada aqui — caso contrário o proxy libera a
 * página, o Server Component percebe a inconsistência e redireciona de
 * volta para /login, e o proxy libera de novo, gerando loop infinito.
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  let userId: string | null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    userId = typeof payload.sub === "string" ? payload.sub : null;
  } catch (error) {
    console.error("[proxy] falha ao verificar JWT:", error);
    return null;
  }
  if (!userId) return null;

  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { active: true } });
    if (!user || !user.active) return null;
    return userId;
  } catch (error) {
    console.error("[proxy] falha ao consultar usuário no banco:", error);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = (await getAuthenticatedUserId(request)) !== null;

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/inicio", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(authenticated ? "/inicio" : "/login", request.url));
  }

  if (!isPublicPath(pathname) && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Exclui assets internos e arquivos estáticos de /public (ex: logo) do gate de
  // autenticação — sem isso, o otimizador de imagem do Next.js (que busca a imagem
  // internamente via HTTP) era redirecionado para /login e falhava.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

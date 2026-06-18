import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminSession, findOrBootstrapAdmin, recordLoginAttempt, verifyAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function loginAdmin(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/admin/login?error=missing");
  }

  const recentFailures = await (prisma as any).adminLoginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  }).catch(() => 0);

  if (recentFailures >= 8) {
    await recordLoginAttempt({ email, success: false, reason: "Muitas tentativas recentes." });
    redirect("/admin/login?error=locked");
  }

  const user = await findOrBootstrapAdmin(email, password);

  if (!user || user.role === "USER") {
    await recordLoginAttempt({ email, success: false, reason: "Usuário não autorizado.", userId: user?.id });
    redirect("/admin/login?error=invalid");
  }

  const ok = verifyAdminPassword(password, user.passwordHash);

  if (!ok) {
    await recordLoginAttempt({ email, success: false, reason: "Senha inválida.", userId: user.id });
    redirect("/admin/login?error=invalid");
  }

  await recordLoginAttempt({ email, success: true, reason: "Login aprovado.", userId: user.id });
  await createAdminSession(user);
  redirect("/admin");
}

function errorMessage(error: string | string[] | undefined) {
  const value = Array.isArray(error) ? error[0] : error;
  if (value === "missing") return "Informe e-mail e senha.";
  if (value === "invalid") return "E-mail ou senha inválidos.";
  if (value === "locked") return "Muitas tentativas recentes. Aguarde alguns minutos.";
  if (value === "logout") return "Sessão encerrada.";
  return "";
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = errorMessage(params.error);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="pixel-panel mx-auto max-w-md p-6">
        <div className="text-center text-5xl">🔐</div>
        <h1 className="mt-4 text-center text-2xl font-black text-slate-950">Entrar na central Mural29</h1>
        <p className="mt-2 text-center text-sm font-bold leading-relaxed text-slate-500">Use seu acesso administrativo. O primeiro dono pode ser criado com ADMIN_EMAIL + ADMIN_PASSWORD.</p>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm font-black text-red-700">{error}</div>}

        <form action={loginAdmin} className="mt-5 space-y-3">
          <input name="email" type="email" required autoComplete="username" placeholder="E-mail do admin" className="pixel-input" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Senha" className="pixel-input" />
          <button type="submit" className="pixel-btn pixel-btn--dark w-full !rounded-2xl !py-4 !text-sm">Entrar</button>
        </form>

        <div className="mt-4 rounded-2xl bg-yellow-50 p-3 text-xs font-bold leading-relaxed text-yellow-900">
          Fallback emergencial: se usar <strong>/admin?secret=SUA_SENHA</strong>, o acesso antigo continua funcionando.
        </div>

        <Link href="/" className="pixel-btn pixel-btn--ghost mt-4 flex w-full !rounded-2xl !py-4 !text-sm">Voltar ao mural</Link>
      </div>
    </main>
  );
}

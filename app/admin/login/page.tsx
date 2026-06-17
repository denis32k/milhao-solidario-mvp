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
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-center text-5xl">🔐</div>
        <h1 className="mt-4 text-center text-2xl font-black text-slate-950">Entrar no admin</h1>
        <p className="mt-2 text-center text-sm font-bold leading-relaxed text-slate-500">Use o usuário administrativo. O primeiro dono pode ser criado por ADMIN_EMAIL + ADMIN_PASSWORD.</p>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm font-black text-red-700">{error}</div>}

        <form action={loginAdmin} className="mt-5 space-y-3">
          <input name="email" type="email" required autoComplete="username" placeholder="E-mail do admin" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-950" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Senha" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-950" />
          <button type="submit" className="w-full rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Entrar</button>
        </form>

        <div className="mt-4 rounded-2xl bg-yellow-50 p-3 text-xs font-bold leading-relaxed text-yellow-900">
          Fallback emergencial: se usar <strong>/admin?secret=SUA_SENHA</strong>, o acesso antigo continua funcionando.
        </div>

        <Link href="/" className="mt-4 block rounded-2xl bg-slate-100 py-4 text-center text-sm font-black text-slate-800">Voltar ao mural</Link>
      </div>
    </main>
  );
}

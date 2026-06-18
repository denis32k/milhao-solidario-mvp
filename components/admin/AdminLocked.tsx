import Link from "next/link";

export default function AdminLocked({ nextPath = "/admin" }: { nextPath?: string }) {
  const loginHref = `/admin/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="pixel-panel mx-auto max-w-md p-6 text-center">
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Central protegida</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Entre com usuário e senha. Depois do login você volta para a página administrativa que estava tentando abrir.
        </p>
        <Link href={loginHref} className="pixel-btn pixel-btn--dark mt-5 flex w-full !rounded-2xl !py-4 !text-sm">Entrar no admin</Link>
        <Link href="/" className="pixel-btn pixel-btn--ghost mt-3 flex w-full !rounded-2xl !py-4 !text-sm">Voltar ao mural</Link>
        <p className="mt-4 text-xs font-bold leading-relaxed text-slate-400">
          O fallback antigo com <strong>/admin?secret=SUA_SENHA</strong> continua apenas como emergência.
        </p>
      </div>
    </main>
  );
}

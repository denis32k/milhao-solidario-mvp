import Link from "next/link";

export default function AdminLocked({ nextPath = "/admin" }: { nextPath?: string }) {
  const loginHref = `/admin/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="admin-auth-shell">
      <div className="admin-auth-card text-center">
        <div className="admin-auth-mark mx-auto">29</div>
        <p className="admin-auth-kicker">Acesso protegido</p>
        <h1 className="admin-auth-title">Central administrativa protegida</h1>
        <p className="admin-auth-description">
          Entre com usuário e senha. Depois do login você volta para a página administrativa que estava tentando abrir.
        </p>
        <Link href={loginHref} className="admin-auth-button mt-5">Entrar no admin</Link>
        <Link href="/" className="admin-auth-link mt-3">Voltar ao mural</Link>
        <p className="mt-4 text-xs font-bold leading-relaxed text-slate-400">
          O fallback antigo com <strong>/admin?secret=SUA_SENHA</strong> continua apenas como emergência.
        </p>
      </div>
    </main>
  );
}

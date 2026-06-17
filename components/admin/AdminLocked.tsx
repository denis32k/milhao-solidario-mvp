import Link from "next/link";

export default function AdminLocked() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Admin protegido</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Entre com usuário e senha do admin. O acesso antigo com <strong>/admin?secret=SUA_SENHA</strong> continua como emergência.
        </p>
        <Link href="/admin/login" className="mt-5 block rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Entrar no admin</Link>
        <Link href="/" className="mt-3 block rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-800">Voltar ao mural</Link>
      </div>
    </main>
  );
}

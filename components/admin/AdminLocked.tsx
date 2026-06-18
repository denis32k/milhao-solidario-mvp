import Link from "next/link";

export default function AdminLocked() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Central protegida</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Entre com usuário e senha. O acesso antigo com <strong>/admin?secret=SUA_SENHA</strong> continua apenas como emergência.
        </p>
        <Link href="/admin/login" className="pixel-btn pixel-btn--dark mt-5 flex w-full !rounded-2xl !py-4 !text-sm">Entrar na central Mural29</Link>
        <Link href="/" className="mt-3 block rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-800">Voltar ao mural</Link>
      </div>
    </main>
  );
}

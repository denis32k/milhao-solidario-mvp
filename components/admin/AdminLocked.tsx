import Link from "next/link";

export default function AdminLocked() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="text-5xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">Admin protegido</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Digite a senha do admin ou acesse usando <strong>/admin?secret=SUA_SENHA</strong>.
        </p>
        <form action="/admin" className="mt-5 space-y-3">
          <input
            name="secret"
            type="password"
            autoComplete="current-password"
            placeholder="Senha do admin"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-800 outline-none focus:border-slate-950"
          />
          <button type="submit" className="w-full rounded-2xl bg-slate-950 py-4 text-sm font-black text-white">Entrar no admin</button>
        </form>
        <Link href="/" className="mt-3 block rounded-2xl bg-slate-100 py-4 text-sm font-black text-slate-800">Voltar ao mural</Link>
      </div>
    </main>
  );
}

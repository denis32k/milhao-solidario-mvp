import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { withAdminSecret } from "@/lib/admin";

export default function AdminPageHeader({
  secret,
  active,
  title,
  description,
}: {
  secret: string;
  active: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <Link href="/" className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow">← Voltar ao mural</Link>
      <section className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Painel admin</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
        <Link href={withAdminSecret("/admin", secret)} className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Dashboard principal</Link>
      </section>
      <AdminNav secret={secret} active={active} />
    </>
  );
}

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
      <Link href="/" className="pixel-btn pixel-btn--light mb-5 !rounded-2xl !px-4 !py-2 !text-sm">← Voltar ao mural</Link>
      <section className="mb-6 overflow-hidden rounded-[2rem] border-2 border-slate-950 bg-[linear-gradient(135deg,#0f172a,#1e293b_55%,#f97316)] p-5 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-wide text-yellow-300">Central operacional</p>
        <h1 className="mt-2 text-3xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
        <Link href={withAdminSecret("/admin", secret)} className="pixel-btn pixel-btn--light mt-4 !rounded-2xl !px-4 !py-2 !text-xs">Dashboard principal</Link>
      </section>
      <AdminNav secret={secret} active={active} />
    </>
  );
}

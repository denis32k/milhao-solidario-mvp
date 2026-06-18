import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";

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
      <AdminSidebar secret={secret} active={active} />
      <AdminTopbar secret={secret} title={title} />
      <AdminMobileNav secret={secret} active={active} />
      <section className="admin-page-heading">
        <div className="admin-page-heading-grid">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Central operacional</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="admin-page-heading-badges">
            <span className="admin-page-badge">Painel SaaS</span>
            <span className="admin-page-badge muted">Fluxo em tempo real</span>
            <span className="admin-page-badge muted">Operação segura</span>
          </div>
        </div>
      </section>
    </>
  );
}

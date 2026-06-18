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
      <section className="admin-page-heading admin-page-heading-flat">
        <div>
          <p className="admin-page-kicker">Painel administrativo</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
    </>
  );
}

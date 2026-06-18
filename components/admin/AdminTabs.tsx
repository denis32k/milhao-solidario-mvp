import Link from "next/link";
import { withAdminSecret } from "@/lib/admin";

type Tab = { value: string; label: string; count?: number };

export default function AdminTabs({
  secret,
  basePath,
  paramName,
  active,
  tabs,
}: {
  secret: string;
  basePath: string;
  paramName: string;
  active: string;
  tabs: Tab[];
}) {
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => {
        const href = tab.value === "ALL" ? basePath : `${basePath}?${paramName}=${encodeURIComponent(tab.value)}`;
        const selected = (active || "ALL") === tab.value;
        return (
          <Link key={tab.value} href={withAdminSecret(href, secret)} className={`admin-tab ${selected ? "is-active" : ""}`}>
            <span>{tab.label}</span>
            {typeof tab.count === "number" && <strong>{tab.count}</strong>}
          </Link>
        );
      })}
    </nav>
  );
}

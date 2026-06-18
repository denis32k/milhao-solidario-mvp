import { statusLabel, statusTone } from "@/lib/status-labels";

export default function AdminStatusBadge({ value }: { value: string | null | undefined }) {
  const raw = String(value || "");
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black normal-case ${statusTone(raw)}`}>{statusLabel(raw)}</span>;
}

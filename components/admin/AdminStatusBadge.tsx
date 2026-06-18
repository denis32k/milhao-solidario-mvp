const statusText: Record<string, string> = {
  APPROVED: "Pagamento confirmado",
  PENDING: "Aguardando pagamento",
  REJECTED: "Pagamento não aprovado",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  EXPIRED: "Reserva expirada",
  REFUNDED: "Reembolso processado",
  SOLD: "Publicado",
  RESERVED: "Reservado",
  AVAILABLE: "Disponível",
  LOCKED: "Bloqueado",
  BLOCKED: "Bloqueado",
  ACTIVE: "Publicado",
  IMAGE_BLOCKED: "Imagem bloqueada",
  LINK_BLOCKED: "Link bloqueado",
  PUBLISHED_NOT_REVIEWED: "Publicado — aguardando revisão",
  CHANGES_REQUESTED: "Ajuste solicitado",
  HIDDEN_BY_ADMIN: "Oculto",
  OPEN: "Aberta",
  REVIEWING: "Em análise",
  RESOLVED: "Resolvida",
  WARNED: "Avisada",
  DISMISSED: "Ignorada",
  BANNED: "Banido",
  USER: "Cliente",
  ADMIN: "Admin",
  OWNER: "Dono",
};

function tone(value: string) {
  if (["APPROVED", "SOLD", "ACTIVE", "RESOLVED", "AVAILABLE"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (["PENDING", "RESERVED", "PUBLISHED_NOT_REVIEWED", "REVIEWING", "CHANGES_REQUESTED", "WARNED"].includes(value)) return "bg-yellow-50 text-yellow-700 border-yellow-100";
  if (["REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "REFUNDED", "BLOCKED", "IMAGE_BLOCKED", "LINK_BLOCKED", "HIDDEN_BY_ADMIN", "BANNED"].includes(value)) return "bg-red-50 text-red-700 border-red-100";
  if (["LOCKED", "IGNORED", "DISMISSED"].includes(value)) return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-100";
}

export default function AdminStatusBadge({ value }: { value: string | null | undefined }) {
  const raw = String(value || "UNKNOWN");
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-black ${tone(raw)}`}>{statusText[raw] || "Não informado"}</span>;
}

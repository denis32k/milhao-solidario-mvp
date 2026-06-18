export const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Pagamento confirmado",
  PENDING: "Aguardando pagamento",
  REJECTED: "Pagamento não aprovado",
  CANCELLED: "Compra cancelada",
  CANCELED: "Compra cancelada",
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
  APPROVED_CONTENT: "Conteúdo aprovado",
  CHANGES_REQUESTED: "Ajuste solicitado",
  HIDDEN_BY_ADMIN: "Oculto pelo admin",

  OPEN: "Aberta",
  REVIEWING: "Em análise",
  WARNED: "Avisada",
  RESOLVED: "Resolvida",
  DISMISSED: "Ignorada",
  BANNED: "Banido",

  SUCCESS: "Concluído",
  FAILED: "Falhou",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivada",

  USER: "Cliente",
  ADMIN: "Admin",
  OWNER: "Dono",
  FINANCE: "Financeiro",
  MODERATOR: "Moderador",
  SUPPORT: "Suporte",
  DEV: "Dev",
};

export function statusLabel(value: string | null | undefined, fallback = "Não informado") {
  const key = String(value || "").trim();
  if (!key) return fallback;
  return STATUS_LABELS[key] || key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusTone(value: string | null | undefined) {
  const key = String(value || "").trim();

  if (["APPROVED", "SOLD", "ACTIVE", "RESOLVED", "AVAILABLE", "SUCCESS"].includes(key)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  if (["PENDING", "RESERVED", "PUBLISHED_NOT_REVIEWED", "REVIEWING", "CHANGES_REQUESTED", "WARNED", "DRAFT"].includes(key)) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  if (["REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "REFUNDED", "BLOCKED", "IMAGE_BLOCKED", "LINK_BLOCKED", "HIDDEN_BY_ADMIN", "BANNED", "FAILED"].includes(key)) {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }

  if (["LOCKED", "DISMISSED", "ARCHIVED"].includes(key)) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-100";
}

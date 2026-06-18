"use client";

import { useState } from "react";

export default function CopyTextButton({ text, label = "Copiar", copiedLabel = "Copiado" }: { text: string; label?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      window.prompt("Copie o link abaixo:", text);
    }
  }

  return (
    <button type="button" onClick={copy} className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50">
      {copied ? copiedLabel : label}
    </button>
  );
}

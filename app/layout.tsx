import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mural 29",
  description: "Mural comercial gamificado com 29 mil tijolinhos digitais.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

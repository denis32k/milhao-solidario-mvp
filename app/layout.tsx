import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tijolinho Digital",
  description: "Mural comercial gamificado construído tijolinho por tijolinho.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

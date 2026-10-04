import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const displayFont = Barlow_Condensed({
  weight: "800",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Afilados Club — Temporada 2026",
  description:
    "La sede de una temporada entre amigos. Cochabamba, 28 de noviembre al 21 de diciembre de 2026. No es un calendario. Es una temporada.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}

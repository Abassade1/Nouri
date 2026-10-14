import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

import { Header } from "@/components/Header";
import { getLocale, isRtl } from "@/lib/i18n";

import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-latin" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600"], variable: "--font-arabic" });

export const metadata: Metadata = { title: "Nouri Admin", robots: { index: false, follow: false } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={`${plex.variable} ${plexArabic.variable}`}>
      <body>
        <Header />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Manrope, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { StorageNotice } from "@/components/storage-notice";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LoreSync — See the shape of your conversations",
  description: "Explore WhatsApp and Discord chat exports on your device, with optional cloud storage when you sign in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${archivo.variable} ${newsreader.variable} ${plexMono.variable}`}
    >
      <body><ThemeProvider>{children}<StorageNotice /></ThemeProvider></body>
    </html>
  );
}

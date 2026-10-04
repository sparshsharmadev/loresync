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
  metadataBase: new URL("https://loresyncweb.vercel.app"),
  verification: {
    google: "j9zoyKoJEDuGyZRXFS7Ia9h9iPoy5mp_ys6MBEc9iYg",
  },
  title: {
    default: "LoreSync — See the shape of your conversations",
    template: "%s · LoreSync",
  },
  description: "Explore WhatsApp and Discord chat exports with interactive timelines, activity heatmaps, participant patterns, and reply insights. Analyze locally, with optional cloud archive.",
  applicationName: "LoreSync",
  category: "Productivity",
  keywords: [
    "WhatsApp chat analysis",
    "Discord chat analysis",
    "chat history visualizer",
    "conversation timeline",
    "message activity heatmap",
    "private chat analysis",
    "chat export viewer",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LoreSync",
    title: "LoreSync — See the shape of your conversations",
    description: "Explore chat history through interactive timelines, activity heatmaps, participant patterns, and reply insights.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoreSync — See the shape of your conversations",
    description: "Explore chat history through interactive timelines, activity heatmaps, participant patterns, and reply insights.",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
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

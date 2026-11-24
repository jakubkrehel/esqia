import { InterfereProvider } from "@interfere/next/provider";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { inter, libreBaskerville, paperMono } from "./fonts";
import "@/styles/globals.css";
import { cn } from "@/lib/utils";

const domain = "https://esqia.jakub.kr";
const siteName = "Esqia";
const siteDescription =
  "Edit your MDX from the rendered page while you write. A dev-only editor for Next.js.";
const twitterHandle = "@jakubkrehel";
const SITE_OG_IMAGE = "/og.png";

export const viewport = {
  initialScale: 1,
  themeColor: [
    { color: "#ffffff", media: "(prefers-color-scheme: light)" },
    { color: "#101010", media: "(prefers-color-scheme: dark)" },
  ],
  width: "device-width",
};

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description: siteDescription,
  metadataBase: new URL(domain),
  openGraph: {
    description: siteDescription,
    images: [
      {
        alt: siteName,
        height: 630,
        type: "image/png",
        url: SITE_OG_IMAGE,
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName,
    title: siteName,
    type: "website",
    url: domain,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: siteName,
  twitter: {
    card: "summary_large_image",
    creator: twitterHandle,
    description: siteDescription,
    images: [
      {
        alt: siteName,
        url: SITE_OG_IMAGE,
      },
    ],
    site: twitterHandle,
    title: siteName,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.variable} lang="en">
      <body
        className={cn(
          libreBaskerville.variable,
          paperMono.variable,
          "bg-gray-background font-sans text-base text-gray-1200 antialiased"
        )}
      >
        <InterfereProvider>
          <MotionProvider>{children}</MotionProvider>
        </InterfereProvider>
        <Analytics />
      </body>
    </html>
  );
}

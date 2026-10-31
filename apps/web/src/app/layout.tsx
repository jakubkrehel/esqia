import { Esqe } from "esqe";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { berkeleyMono, inter, libreBaskerville } from "./fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  description:
    "Edit your MDX from the rendered page while you write. A dev-only editor for Next.js.",
  metadataBase: new URL("https://esqe.jakub.kr"),
  title: "esqe",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.variable} lang="en">
      <body
        className={`${libreBaskerville.variable} ${berkeleyMono.variable} bg-gray-background font-sans text-base text-gray-1200 antialiased`}
      >
        {children}
        {process.env.NODE_ENV === "development" && <Esqe />}
      </body>
    </html>
  );
}

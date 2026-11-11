import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { berkeleyMono, inter, libreBaskerville } from "./fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  description:
    "Edit your MDX from the rendered page while you write. A dev-only editor for Next.js.",
  metadataBase: new URL("https://esqia.jakub.kr"),
  title: "esqia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.variable} lang="en">
      <body
        className={`${libreBaskerville.variable} ${berkeleyMono.variable} bg-gray-background font-sans text-base text-gray-1200 antialiased`}
      >
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}

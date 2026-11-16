import localFont from "next/font/local";

export const inter = localFont({
  adjustFontFallback: "Arial",
  display: "swap",
  fallback: ["system-ui", "arial"],
  src: [
    { path: "./fonts/InterVariable.woff2", style: "normal", weight: "400 700" },
  ],
  variable: "--font-inter",
});

export const libreBaskerville = localFont({
  display: "swap",
  src: [
    {
      path: "./fonts/LibreBaskerville-Italic.woff2",
      style: "italic",
      weight: "400",
    },
  ],
  variable: "--font-libre-baskerville",
});

export const paperMono = localFont({
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
  src: [
    {
      path: "./fonts/PaperMono-Regular.woff2",
      style: "normal",
      weight: "400",
    },
  ],
  variable: "--font-paper-mono",
});

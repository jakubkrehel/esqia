import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex align-middle h-5 min-w-5 flex-none select-none items-center justify-center rounded-md border border-preview-border bg-preview-bg px-1 font-[450] font-sans text-[11px] text-gray-1100 uppercase">
      {children}
    </kbd>
  );
}

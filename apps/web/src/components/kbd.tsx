import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 flex-none -translate-y-px select-none items-center justify-center rounded-md border border-preview-bg bg-clip-padding bg-gray-200 px-1 align-middle font-book font-sans text-[11px] text-gray-1100 uppercase leading-4 shadow-custom inset-ring inset-ring-black/6 dark:inset-ring-white/8">
      {children}
    </kbd>
  );
}

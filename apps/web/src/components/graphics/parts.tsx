import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Frame({
  children,
  className,
  nested = false,
}: {
  children: ReactNode;
  className?: string;
  nested?: boolean;
}) {
  const stage = (
    <div
      className={cn(
        "graphic-stage absolute top-0 left-1/2 h-74 w-148 origin-top -translate-x-1/2",
        className
      )}
    >
      {children}
    </div>
  );

  if (!nested) {
    return (
      <div
        aria-hidden="true"
        className="graphic-frame relative aspect-2/1 w-full select-none overflow-hidden rounded-2xl bg-preview-bg shadow-custom"
        data-media-block=""
      >
        {stage}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-full select-none rounded-2xl bg-preview-bg p-1 shadow-custom"
      data-media-block=""
    >
      <div className="graphic-frame relative aspect-2/1 overflow-hidden rounded-xl bg-preview-bg shadow-custom">
        {stage}
      </div>
    </div>
  );
}

export function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block w-fit rounded-lg bg-preview-bg p-0.75 shadow-custom",
        className
      )}
    >
      <span className="block whitespace-nowrap rounded-[5px] bg-gray-200 px-1.5 py-0.5 font-mono text-gray-1100 text-xs shadow-custom">
        {children}
      </span>
    </span>
  );
}

export function Caret({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "graphic-caret -mr-0.75 ml-px inline-block h-5 w-0.5 rounded-full bg-sky-400 align-text-bottom",
        className
      )}
    />
  );
}

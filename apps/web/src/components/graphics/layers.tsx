import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Bar, Chip, Frame } from "./parts";

function Sheet({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col gap-2 rounded-2xl p-4 shadow-custom",
        className
      )}
    >
      {children}
    </div>
  );
}

function Callout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute left-84 flex -translate-y-1/2 items-center gap-2",
        className
      )}
    >
      <span className="h-px w-10 bg-gray-500" />
      <Chip>{children}</Chip>
    </div>
  );
}

export function Layers() {
  return (
    <Frame>
      <div className="absolute top-36 left-32 size-40 rotate-x-60 -rotate-z-45 transform-3d">
        <Sheet className="bg-gray-100">
          <Bar className="h-1 w-10 bg-gray-600" />
          <Bar className="mt-1 h-1 w-full bg-gray-500" />
          <Bar className="h-1 w-11/12 bg-gray-500" />
          <Bar className="h-1 w-2/3 bg-gray-500" />
          <Bar className="mt-1 h-1 w-full bg-gray-500" />
          <Bar className="h-1 w-1/2 bg-gray-500" />
          <Bar className="mt-1 h-1 w-16 bg-gray-600" />
        </Sheet>
        <Sheet className="translate-z-16 bg-preview-bg dark:bg-gray-200">
          <Bar className="h-3 w-16 bg-gray-500" />
          <Bar className="mt-1 w-full" />
          <Bar className="w-3/4" />
          <span className="mt-1 block flex-1 rounded-lg border-overlay bg-conic from-neutral-300 to-white dark:from-neutral-500 dark:to-black" />
        </Sheet>
        <Sheet className="translate-z-32 bg-sky-400/5 shadow-none outline-1 outline-sky-400/40">
          <span className="mt-6 block h-9 rounded-md bg-sky-400/10 outline-2 outline-sky-400" />
          <span className="mt-auto flex h-5 w-14 items-center justify-center gap-1 self-end rounded-full bg-preview-bg shadow-custom">
            <span className="size-1 bg-gray-1200" />
            <span className="h-2.5 w-0.5 bg-gray-1200" />
            <span className="size-1 bg-gray-1200" />
          </span>
        </Sheet>
      </div>
      <Callout className="top-21">{"<Esqia />"}</Callout>
      <Callout className="top-35">page</Callout>
      <Callout className="top-49">content.mdx</Callout>
    </Frame>
  );
}

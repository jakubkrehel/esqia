import type { ReactNode } from "react";
import { CodeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Frame } from "./parts";

type Kind = "added" | "removed" | "same";

function Line({
  children,
  kind = "same",
  number,
}: {
  children?: ReactNode;
  kind?: Kind;
  number: number;
}) {
  return (
    <span
      className={cn(
        "flex whitespace-pre",
        kind === "added" &&
          "bg-diff-added/20 text-gray-1200 dark:bg-diff-added/10",
        kind === "removed" &&
          "bg-diff-removed/20 text-gray-1200 dark:bg-diff-removed/10"
      )}
    >
      <span
        className={cn(
          "w-1",
          kind === "added" && "bg-diff-added",
          kind === "removed" && "bg-diff-removed"
        )}
      />
      <span
        className={cn(
          "mr-4 w-8 text-right text-gray-800",
          kind === "added" && "text-diff-added",
          kind === "removed" && "text-diff-removed"
        )}
      >
        {number}
      </span>
      <span>{children}</span>
    </span>
  );
}

export function Diff() {
  return (
    <Frame className="flex flex-col">
      <div className="mx-1 mt-1 flex items-center justify-between rounded-xl bg-gray-100 py-2 pr-3 pl-3 shadow-custom">
        <span className="flex items-center gap-2">
          <CodeIcon className="size-4 text-gray-1000" />
          <span className="font-mono text-gray-1100 text-small">
            content.mdx
          </span>
        </span>
        <span className="flex gap-2 font-mono text-small">
          <span className="text-diff-removed">-1</span>
          <span className="text-diff-added">+1</span>
        </span>
      </div>
      <pre className="flex flex-1 flex-col justify-center font-mono text-gray-1100 text-small leading-6">
        <Line number={1}>## How It Works</Line>
        <Line number={2} />
        <Line number={3}>Click into any markdown on the page and edit it.</Line>
        <Line number={4} />
        <Line kind="removed" number={5}>
          Drag any block to move it.
        </Line>
        <Line kind="added" number={5}>
          Drag any block to move it
          <span className="rounded-sm bg-diff-added/30 dark:bg-diff-added/25">
            , including demos
          </span>
          .
        </Line>
        <Line number={6} />
        <Line number={7}>
          Select text to apply **bold**, *italic* or `code`.
        </Line>
        <Line number={8} />
      </pre>
    </Frame>
  );
}

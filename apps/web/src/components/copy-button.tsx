"use client";

import { IconCircleCheck } from "central-icons/IconCircleCheck";
import { IconSquareBehindSquare1 } from "central-icons-outlined/IconSquareBehindSquare1";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  md: { button: "size-9 rounded-lg", icon: "size-4.5" },
  sm: { button: "size-7 rounded-md", icon: "size-4" },
};

export function CopyButton({
  className,
  duration = 1000,
  label,
  size,
  text,
}: {
  className?: string;
  duration?: number;
  label: string;
  size: keyof typeof sizes;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), duration);
    return () => clearTimeout(timer);
  }, [copied, duration]);

  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={cn(
        "interactive pressable group grid shrink-0 cursor-pointer place-items-center hover-hover:hover:bg-gray-300",
        sizes[size].button,
        className
      )}
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => undefined)
      }
      type="button"
    >
      <IconSquareBehindSquare1
        className={cn(
          "col-start-1 row-start-1 text-gray-1000 transition-[opacity,scale,filter,color] duration-300 ease-standard group-hover:text-gray-1200",
          sizes[size].icon,
          copied && "scale-25 opacity-0 blur-xs"
        )}
      />
      <IconCircleCheck
        className={cn(
          "col-start-1 row-start-1 text-gray-1000 transition-[opacity,scale,filter] duration-300 ease-standard",
          sizes[size].icon,
          !copied && "scale-25 opacity-0 blur-xs"
        )}
      />
    </button>
  );
}

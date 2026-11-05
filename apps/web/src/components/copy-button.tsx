"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({
  className,
  duration = 1000,
  iconClassName,
  label,
  text,
}: {
  className: string;
  duration?: number;
  iconClassName: string;
  label: string;
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
      className={`interactive pressable group grid shrink-0 cursor-pointer place-items-center hover-hover:hover:bg-gray-300 ${className}`}
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => undefined)
      }
      type="button"
    >
      <CopyIcon
        className={`col-start-1 row-start-1 text-gray-1000 transition-[opacity,scale,filter,color] duration-300 ease-standard group-hover:text-gray-1200 ${iconClassName} ${copied ? "scale-25 opacity-0 blur-xs" : ""}`}
      />
      <CheckIcon
        className={`col-start-1 row-start-1 text-gray-1000 transition-[opacity,scale,filter] duration-300 ease-standard ${iconClassName} ${copied ? "" : "scale-25 opacity-0 blur-xs"}`}
      />
    </button>
  );
}

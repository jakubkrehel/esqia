import { useEffect } from "react";
import type { EsqiaOptions } from "../shared/config";
import { configured } from "./api";

export interface EsqiaProps {
  demo?: EsqiaOptions & { sources: Record<string, string> };
  toolbar?: string;
}

export function Esqia({ demo, toolbar }: EsqiaProps) {
  useEffect(() => {
    if (!(demo || configured)) {
      return;
    }
    const closing = new AbortController();
    const load = async () => {
      const { mount } = await import("./mount");
      if (!closing.signal.aborted) {
        closing.signal.addEventListener("abort", mount({ demo, toolbar }));
      }
    };
    load();

    return () => closing.abort();
  }, [demo, toolbar]);

  return null;
}

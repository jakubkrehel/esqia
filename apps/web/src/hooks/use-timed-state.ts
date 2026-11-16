import { useState } from "react";
import { useTimeouts } from "@/hooks/use-timeouts";

export function useTimedState<T>(initial: T, duration: number) {
  const [value, setValue] = useState(initial);
  const { after, cancel } = useTimeouts();

  const set = (next: T) => {
    setValue(next);
    cancel();
    after(() => setValue(initial), duration);
  };

  const reset = () => {
    cancel();
    setValue(initial);
  };

  return [value, set, reset] as const;
}

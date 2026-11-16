import { useEffect, useRef } from "react";

export function useTimeouts() {
  const timeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = timeouts.current;
    return () => {
      for (const id of pending) {
        clearTimeout(id);
      }
      pending.clear();
    };
  }, []);

  const after = (callback: () => void, duration: number) => {
    const id = setTimeout(() => {
      timeouts.current.delete(id);
      callback();
    }, duration);
    timeouts.current.add(id);
  };

  const cancel = () => {
    for (const id of timeouts.current) {
      clearTimeout(id);
    }
    timeouts.current.clear();
  };

  return { after, cancel };
}

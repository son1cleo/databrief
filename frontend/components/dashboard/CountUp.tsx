"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
}

export function CountUp({ value, duration = 600 }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return <>{display}</>;
}

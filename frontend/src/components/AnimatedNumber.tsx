import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";
import { fmt } from "../services/api";

export function AnimatedNumber({ value, digits = 2 }: { value: number; digits?: number }) {
  const { ref, visible } = useInView<HTMLSpanElement>();
  const [frame, setFrame] = useState<{ target: number; value: number }>();

  useEffect(() => {
    if (!visible || !Number.isFinite(value)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const start = performance.now();
    let request = requestAnimationFrame(function tick(now) {
      if (motion.matches) {
        setFrame(undefined);
        return;
      }
      const fraction = Math.min(1, (now - start) / 460);
      setFrame(fraction === 1 ? undefined : {
        target: value,
        value: value * (1 - (1 - fraction) ** 3),
      });
      if (fraction < 1) request = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(request);
  }, [value, visible]);

  const final = fmt(value, digits);
  return (
    <span ref={ref} className="animated-number" aria-label={final}>
      <span aria-hidden="true">{final}</span>
      <span aria-hidden="true">{frame?.target === value ? fmt(frame.value, digits) : final}</span>
    </span>
  );
}

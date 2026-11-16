import type { CSSProperties } from "react";
import { Box } from "lucide-react";
import { useInView } from "../hooks/useInView";

const particles = [[8, 15], [15, 45], [20, 72], [24, 27], [30, 85], [6, 76],
  [71, 84], [76, 23], [81, 65], [85, 36], [91, 75], [94, 18]];

export function HeroAtmosphere() {
  const { ref, visible } = useInView<HTMLDivElement>(false);
  return (
    <div ref={ref} className="hero-atmosphere" data-playing={visible} aria-hidden="true">
      {particles.map(([x, y], index) => (
        <i key={x} style={{ left: x + "%", top: y + "%", "--phase": -index * 0.8 + "s" } as CSSProperties} />
      ))}
      <Box className="hero-crystal" strokeWidth={0.7} />
    </div>
  );
}

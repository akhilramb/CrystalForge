import { useEffect, useRef, useState } from "react";

/** Reveal once, after the element reaches the viewport by default. */
export function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (once && entry.isIntersecting) observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [once]);

  return { ref, visible };
}

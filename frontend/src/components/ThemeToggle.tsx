import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const storageKey = "cf-display-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "dark";
    } catch {
      return false;
    }
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem(storageKey, dark ? "dark" : "light");
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }, [dark]);

  return (
    <button type="button" className="ghost theme-toggle" aria-label="Dark mode"
      aria-pressed={dark} title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark(!dark)}>
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}

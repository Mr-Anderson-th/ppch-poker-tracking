import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "ppch_theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(KEY);
  if (v === "dark" || v === "light") return v;
  return "light";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function setTheme(t: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
  applyTheme(t);
  window.dispatchEvent(new Event("ppch-theme"));
}

export function useTheme() {
  const [theme, setT] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => setT(getStoredTheme());
    sync();
    window.addEventListener("ppch-theme", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ppch-theme", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

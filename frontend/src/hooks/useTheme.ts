import { useCallback, useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "devos.theme";

// Dark is the default (no class on <html>). The `light` class opts into the
// light theme. Choice is persisted across sessions.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(KEY) as Theme) ?? "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return { theme, toggle };
}

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";
const KEY = "meridian-theme";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(KEY) as Theme | null) || "dark";
      setThemeState(saved);
      applyTheme(saved);
    } catch {
      applyTheme("dark");
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem(KEY, t); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(KEY, next); } catch {}
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Force dark mode for a specific route (landing, login, apply). Restores previous user preference on unmount. */
export function useForceDark() {
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    root.classList.remove("light");
    const prevScheme = root.style.colorScheme;
    root.style.colorScheme = "dark";
    return () => {
      try {
        const saved = (localStorage.getItem(KEY) as Theme | null) || "dark";
        if (saved === "light") {
          root.classList.remove("dark");
          root.classList.add("light");
          root.style.colorScheme = "light";
        } else if (!had) {
          root.classList.add("dark");
          root.style.colorScheme = prevScheme || "dark";
        }
      } catch {}
    };
  }, []);
}

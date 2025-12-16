"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ThemeOption = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeOption;
  setTheme: (next: ThemeOption) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getStoredTheme(): ThemeOption {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem("theme");
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeOption) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.theme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOption>(() => getStoredTheme());

  const setTheme = useCallback((next: ThemeOption) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  useIsomorphicLayoutEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Garante que ao recarregar atualizamos com valor armazenado (ex. mudança via storage event)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "theme" && event.newValue) {
        const value = event.newValue === "dark" ? "dark" : "light";
        setThemeState(value);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}


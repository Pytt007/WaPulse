"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((currentTheme: Theme) => {
    if (typeof window === "undefined") return;
    try {
      const root = window.document.documentElement;
      if (currentTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } catch (e) {
      console.error("[Theme] Failed to apply theme class:", e);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("wapulse_theme", newTheme);
      } catch (e) {
        console.error("[Theme] Failed to write to localStorage:", e);
      }
    }
    applyTheme(newTheme);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Load theme from localStorage only after component mounts on client
  useEffect(() => {
    setMounted(true);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("wapulse_theme");
    } catch (e) {
      console.error("[Theme] Failed to read from localStorage:", e);
    }

    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      if (typeof window !== "undefined" && window.matchMedia) {
        try {
          const mql = window.matchMedia("(prefers-color-scheme: dark)");
          setTheme(mql.matches ? "dark" : "light");
        } catch (e) {
          console.error("[Theme] matchMedia error, fallback to dark:", e);
          setTheme("dark");
        }
      } else {
        setTheme("dark");
      }
    }
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

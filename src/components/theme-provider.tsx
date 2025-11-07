"use client";

import React, { useEffect, useState } from "react";
import type { ThemeProviderProps } from "next-themes/dist/types";
import { ThemeContext, Theme, ThemeContextType } from "../contexts/ThemeContext";

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = "system",
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light" || saved === "system") {
        return saved as Theme;          // ✅ Cast ensures correct literal type
      }
    }
    return defaultTheme as Theme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    setTheme: (t) => {
      localStorage.setItem("theme", t);
      setTheme(t);
    },
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

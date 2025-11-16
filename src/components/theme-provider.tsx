/* eslint-disable react-refresh/only-export-components */
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  PropsWithChildren,
} from "react";

type Theme = "dark" | "light" | "system";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType | null>(null);

const applyThemeToDocument = (theme: Theme) => {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(isDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
};

const ThemeProviderInner: React.FC<PropsWithChildren<{ defaultTheme?: Theme }>> = ({
  children,
  defaultTheme = "system",
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // When in system mode, react to OS theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument("system");
    try {
      mql.addEventListener("change", onChange);
    } catch {
      // Safari
      mql.addListener(onChange);
    }
    return () => {
      try {
        mql.removeEventListener("change", onChange);
      } catch {
        mql.removeListener(onChange);
      }
    };
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const value = useMemo<ThemeContextType>(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ✅ Export both a named and a default export so either import style works
export const ThemeProvider = ThemeProviderInner;
export default ThemeProvider;

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

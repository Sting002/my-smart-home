import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Pure context object (no React components here) */
export const ThemeContext = createContext<ThemeContextType | null>(null);

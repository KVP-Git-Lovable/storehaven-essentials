import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ThemeName = "amber" | "blue" | "pink";

export const THEME_META: Record<ThemeName, { label: string; swatch: string }> = {
  amber: { label: "Amber", swatch: "hsl(28 95% 55%)" },
  blue: { label: "Blue & Black", swatch: "hsl(220 70% 50%)" },
  pink: { label: "Light Pink", swatch: "hsl(336 76% 22%)" },
};

const STORAGE_KEY = "app.theme";
const DEFAULT_THEME: ThemeName = "amber";
const userKey = (userId: string) => `${STORAGE_KEY}.${userId}`;

function isTheme(x: unknown): x is ThemeName {
  return x === "amber" || x === "blue" || x === "pink";
}

function applyThemeClass(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove("theme-amber", "theme-blue", "theme-pink");
  root.classList.add(`theme-${theme}`);
}

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  });

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Resolve the effective theme for the logged-in user.
  // Priority: this user's locally saved choice (most recent explicit action)
  // -> profile preference from the database -> default.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    let local: string | null = null;
    try {
      local = window.localStorage.getItem(userKey(uid));
    } catch {}

    const pref = (profile as { theme_preference?: string } | null)?.theme_preference;

    if (isTheme(local)) {
      if (local !== theme) setThemeState(local);
      // Self-heal: make sure the database matches the user's explicit choice
      if (pref !== local) {
        void supabase
          .from("profiles")
          .update({ theme_preference: local } as never)
          .eq("id", uid);
      }
      return;
    }

    if (isTheme(pref)) {
      if (pref !== theme) setThemeState(pref);
      try {
        window.localStorage.setItem(userKey(uid), pref);
        window.localStorage.setItem(STORAGE_KEY, pref);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, (profile as { theme_preference?: string } | null)?.theme_preference]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
        if (user?.id) window.localStorage.setItem(userKey(user.id), next);
      } catch {}
      if (user?.id) {
        void (async () => {
          const { error } = await supabase
            .from("profiles")
            .update({ theme_preference: next } as never)
            .eq("id", user.id);
          if (error) console.error("Failed to persist theme preference", error);
        })();
      }
    },
    [user?.id],
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "light",

  initializeTheme: () => {
    const saved = localStorage.getItem("theme") as Theme;
    let initialTheme: Theme = "light";

    if (saved) {
      initialTheme = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initialTheme = "dark";
    }

    const root = document.documentElement;
    if (initialTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", initialTheme);
    set({ theme: initialTheme });
  },

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === "light" ? "dark" : "light";
      const root = document.documentElement;

      if (newTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      localStorage.setItem("theme", newTheme);
      return { theme: newTheme };
    }),

  setTheme: (newTheme) => {
    const root = document.documentElement;

    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", newTheme);
    set({ theme: newTheme });
  },
}));

"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <>
          <Sun className="mr-2 h-4 w-4" />
          Light mode
        </>
      ) : (
        <>
          <Moon className="mr-2 h-4 w-4" />
          Dark mode
        </>
      )}
    </Button>
  );
}

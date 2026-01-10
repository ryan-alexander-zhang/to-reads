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
      aria-label="切换主题"
    >
      {isDark ? (
        <>
          <Sun className="mr-2 h-4 w-4" />
          浅色模式
        </>
      ) : (
        <>
          <Moon className="mr-2 h-4 w-4" />
          深色模式
        </>
      )}
    </Button>
  );
}

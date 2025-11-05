"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Hydration-safe theme toggle
 * Prevents SSR/CSR mismatches by delaying theme-dependent rendering until mount.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : undefined;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed right-4 top-4 rounded-md border px-3 py-1 text-sm"
      aria-label="Toggle theme"
    >
      <span suppressHydrationWarning>
        {isDark ? "Light" : "Dark"}
      </span>
    </button>
  );
}

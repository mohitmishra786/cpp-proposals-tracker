"use client";

import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded border border-terminal-border",
        "text-2xs text-terminal-muted",
        className
      )}
    >
      <Terminal className="h-3.5 w-3.5 text-phosphor-amber" />
      <span className="uppercase tracking-widest">CRT</span>
    </div>
  );
}

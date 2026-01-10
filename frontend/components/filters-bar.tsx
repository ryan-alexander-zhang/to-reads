"use client";

import { useEffect, useRef, useState } from "react";

import FilterHorizontalIcon from "@/components/icons/filter-horizontal-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FiltersBarProps = {
  unreadOnly: boolean;
  favoriteOnly: boolean;
  onUnreadChange: (value: boolean) => void;
  onFavoriteChange: (value: boolean) => void;
  className?: string;
};

export function FiltersBar({
  unreadOnly,
  favoriteOnly,
  onUnreadChange,
  onFavoriteChange,
  className,
}: FiltersBarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative" ref={menuRef}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="筛选"
        >
          <FilterHorizontalIcon size={18} color="currentColor" />
          筛选
        </Button>
        {open ? (
          <div
            className="absolute left-0 z-10 mt-2 w-40 rounded-md border border-border bg-card p-2 shadow-sm"
            role="menu"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => onUnreadChange(!unreadOnly)}
              role="menuitemcheckbox"
              aria-checked={unreadOnly}
            >
              <span className={cn("text-primary", unreadOnly ? "opacity-100" : "opacity-0")}>
                ✓
              </span>
              仅未读
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => onFavoriteChange(!favoriteOnly)}
              role="menuitemcheckbox"
              aria-checked={favoriteOnly}
            >
              <span className={cn("text-primary", favoriteOnly ? "opacity-100" : "opacity-0")}>
                ✓
              </span>
              仅收藏
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

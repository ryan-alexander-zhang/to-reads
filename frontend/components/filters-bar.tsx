"use client";

import { Button } from "@/components/ui/button";

type FiltersBarProps = {
  unreadOnly: boolean;
  favoriteOnly: boolean;
  onUnreadChange: (value: boolean) => void;
  onFavoriteChange: (value: boolean) => void;
};

export function FiltersBar({
  unreadOnly,
  favoriteOnly,
  onUnreadChange,
  onFavoriteChange,
}: FiltersBarProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button
        variant={unreadOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onUnreadChange(!unreadOnly)}
        aria-pressed={unreadOnly}
      >
        仅未读
      </Button>
      <Button
        variant={favoriteOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onFavoriteChange(!favoriteOnly)}
        aria-pressed={favoriteOnly}
      >
        仅收藏
      </Button>
    </div>
  );
}

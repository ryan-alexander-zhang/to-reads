"use client";

import DOMPurify from "dompurify";

import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/types";

type ItemCardProps = {
  item: Item;
  onToggleRead: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
};

export function ItemCard({ item, onToggleRead, onToggleFavorite }: ItemCardProps) {
  const summary = DOMPurify.sanitize(item.summary || "");

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            <a href={item.link} className="hover:underline" target="_blank" rel="noreferrer">
              {item.title}
            </a>
          </h3>
          <p className="text-xs text-muted-foreground">
            {item.feed_name} · {item.category ?? "未分类"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={item.is_read ? "outline" : "default"}
            onClick={() => onToggleRead(item)}
            aria-pressed={item.is_read}
          >
            {item.is_read ? "标为未读" : "标为已读"}
          </Button>
          <Button
            size="sm"
            variant={item.is_favorite ? "default" : "outline"}
            onClick={() => onToggleFavorite(item)}
            aria-pressed={item.is_favorite}
          >
            {item.is_favorite ? "已收藏" : "收藏"}
          </Button>
        </div>
      </header>
      {summary ? (
        <div
          className="prose mt-3 max-w-none text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: summary }}
        />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">暂无摘要</p>
      )}
      <footer className="mt-3 text-xs text-muted-foreground">
        {item.published_at ? new Date(item.published_at).toLocaleString() : "未知时间"}
      </footer>
    </article>
  );
}

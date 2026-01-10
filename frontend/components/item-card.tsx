"use client";

import DOMPurify from "dompurify";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/types";

type ItemCardProps = {
  item: Item;
  onMarkRead: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
};

export function ItemCard({ item, onMarkRead, onToggleFavorite }: ItemCardProps) {
  const summary = DOMPurify.sanitize(item.summary || "");

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span
              className={`inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                item.is_read ? "bg-emerald-500" : "bg-rose-500"
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">{item.is_read ? "Read" : "Unread"}</span>
            <a
              href={item.link}
              className="min-w-0 truncate hover:underline"
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (!item.is_read) onMarkRead(item);
              }}
            >
              {item.title}
            </a>
          </h3>
          <p className="text-xs text-muted-foreground">
            {item.feed_name} · {item.category ?? "Uncategorized"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => onToggleFavorite(item)}
            aria-pressed={item.is_favorite}
            aria-label={item.is_favorite ? "Remove favorite" : "Add favorite"}
          >
            {item.is_favorite ? (
              <BookmarkCheck className="h-[18px] w-[18px]" />
            ) : (
              <Bookmark className="h-[18px] w-[18px]" />
            )}
          </Button>
        </div>
      </header>
      {summary ? (
        <div
          className="prose mt-3 max-w-none text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: summary }}
        />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No summary available</p>
      )}
      <footer className="mt-3 text-xs text-muted-foreground">
        {item.published_at ? new Date(item.published_at).toLocaleString() : "Unknown time"}
      </footer>
    </article>
  );
}

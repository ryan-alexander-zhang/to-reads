"use client";

import { useState } from "react";

import { FeedManager } from "@/components/feed-manager";
import { FiltersBar } from "@/components/filters-bar";
import { ItemList } from "@/components/item-list";
import { SearchBar } from "@/components/search-bar";
import { UnreadCount } from "@/components/unread-count";

export function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <FeedManager
        selectedCategory={selectedCategory}
        onSelectCategory={(id) => {
          setSelectedCategory(id);
          setSelectedFeed(null);
        }}
        selectedFeed={selectedFeed}
        onSelectFeed={setSelectedFeed}
      />
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <SearchBar value={search} onChange={setSearch} />
            <UnreadCount categoryId={selectedCategory} feedId={selectedFeed} />
            <FiltersBar
              unreadOnly={unreadOnly}
              favoriteOnly={favoriteOnly}
              onUnreadChange={setUnreadOnly}
              onFavoriteChange={setFavoriteOnly}
            />
          </div>
        </div>
        <ItemList
          categoryId={selectedCategory}
          feedId={selectedFeed}
          search={search}
          unreadOnly={unreadOnly}
          favoriteOnly={favoriteOnly}
        />
      </section>
    </div>
  );
}

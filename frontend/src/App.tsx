import { useEffect, useMemo, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Input } from "./components/ui/input";

//const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";


interface Category {
  id: number;
  name: string;
}

interface Feed {
  id: number;
  name: string;
  url: string;
  category_id: number | null;
  last_fetched_at?: string | null;
  last_status?: string | null;
}

interface Item {
  id: number;
  feed_id: number;
  feed_name: string;
  category_id: number | null;
  category: string | null;
  title: string;
  link: string;
  summary: string;
  published_at: string | null;
}

interface ItemsResponse {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
}

interface ReadLaterEntry {
  id: number;
  item_id: number;
  feed_id: number;
  feed_name: string;
  category_id: number | null;
  category: string | null;
  title: string;
  link: string;
  summary: string;
  published_at: string | null;
  saved_at: string;
}

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsMeta, setItemsMeta] = useState({ total: 0, page: 1, pageSize: 12 });
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [categoryName, setCategoryName] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedCategory, setFeedCategory] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [refreshingFeedId, setRefreshingFeedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"latest" | "readLater">("latest");
  const [readLaterEntries, setReadLaterEntries] = useState<ReadLaterEntry[]>([]);

  const groupedFeeds = useMemo(() => {
    const map = new Map<string, Feed[]>();
    feeds.forEach((feed) => {
      const categoryName = categories.find((category) => category.id === feed.category_id)?.name;
      const key = categoryName ?? "未分类";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(feed);
    });
    return Array.from(map.entries());
  }, [feeds, categories]);

  const readLaterItemIds = useMemo(() => new Set(readLaterEntries.map((entry) => entry.item_id)), [
    readLaterEntries,
  ]);

  const totalPages = Math.max(1, Math.ceil(itemsMeta.total / itemsMeta.pageSize));
  const activeCountLabel =
    activeTab === "latest"
      ? `${itemsMeta.total} 条`
      : `${readLaterEntries.length} 条`;

  const fetchJson = async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  };

  const loadCategories = async () => {
    const data = await fetchJson<Category[]>(`${API_BASE}/api/categories`);
    setCategories(Array.isArray(data) ? data : []);
  };

  const loadFeeds = async () => {
    const data = await fetchJson<Feed[]>(`${API_BASE}/api/feeds`);
    setFeeds(Array.isArray(data) ? data : []);
  };

  const loadItems = async (page: number, pageSize: number, category: number | "all") => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (category !== "all") {
      params.append("category_id", String(category));
    }
    const data = await fetchJson<ItemsResponse>(`${API_BASE}/api/items?${params.toString()}`);
    if (data) {
      setItems(Array.isArray(data.items) ? data.items : []);
      setItemsMeta({ total: data.total ?? 0, page: data.page ?? page, pageSize: data.page_size ?? pageSize });
    } else {
      setItems([]);
      setItemsMeta({ total: 0, page, pageSize });
    }
  };

  const loadReadLater = async () => {
    const data = await fetchJson<ReadLaterEntry[]>(`${API_BASE}/api/read-later`);
    setReadLaterEntries(Array.isArray(data) ? data : []);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadFeeds(), loadReadLater()]);
      await loadItems(itemsMeta.page, itemsMeta.pageSize, selectedCategory);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadItems(itemsMeta.page, itemsMeta.pageSize, selectedCategory);
  }, [itemsMeta.page, itemsMeta.pageSize, selectedCategory]);

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      return;
    }
    await fetch(`${API_BASE}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    setCategoryName("");
    await loadCategories();
  };

  const handleCreateFeed = async () => {
    if (!feedName.trim() || !feedUrl.trim()) {
      return;
    }
    await fetch(`${API_BASE}/api/feeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: feedName.trim(),
        url: feedUrl.trim(),
        category_id: feedCategory === "" ? null : feedCategory,
      }),
    });
    setFeedName("");
    setFeedUrl("");
    setFeedCategory("");
    await loadFeeds();
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/refresh`, { method: "POST" });
      await loadItems(itemsMeta.page, itemsMeta.pageSize, selectedCategory);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshFeed = async (feedId: number) => {
    setRefreshingFeedId(feedId);
    try {
      await fetch(`${API_BASE}/api/feeds/${feedId}/refresh`, { method: "POST" });
      await loadFeeds();
    } finally {
      setRefreshingFeedId(null);
    }
  };

  const handleAddReadLater = async (itemId: number) => {
    await fetch(`${API_BASE}/api/read-later`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    await loadReadLater();
  };

  const handleRemoveReadLater = async (itemId: number) => {
    await fetch(`${API_BASE}/api/read-later/${itemId}`, { method: "DELETE" });
    await loadReadLater();
  };

  const handleCategoryChange = (category: number | "all") => {
    setSelectedCategory(category);
    setItemsMeta((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">To-Reads RSS 阅读器</h1>
            <p className="text-sm text-slate-400">
              聚合 RSS / Atom / JSON Feed，在稍后再读中管理摘要。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleRefreshAll} disabled={loading}>
              {loading ? "刷新中..." : "刷新内容"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">分类</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  onClick={() => handleCategoryChange("all")}
                >
                  全部
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    onClick={() => handleCategoryChange(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="新增分类"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                />
                <Button className="w-full" onClick={handleCreateCategory}>
                  添加分类
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">添加站点</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="站点名称"
                value={feedName}
                onChange={(event) => setFeedName(event.target.value)}
              />
              <Input
                placeholder="RSS / Atom / JSON Feed URL"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
              />
              <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                <label className="mb-1 block text-xs text-slate-400">分类</label>
                <select
                  className="w-full bg-transparent text-sm text-slate-100 focus:outline-none"
                  value={feedCategory}
                  onChange={(event) =>
                    setFeedCategory(event.target.value ? Number(event.target.value) : "")
                  }
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button className="w-full" onClick={handleCreateFeed}>
                添加站点并抓取
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">站点概览</h2>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              {groupedFeeds.length === 0 && <p>暂无站点。</p>}
              {groupedFeeds.map(([group, feedList]) => (
                <div key={group}>
                  <p className="mb-2 font-medium text-slate-200">{group}</p>
                  <ul className="space-y-2">
                    {feedList.map((feed) => (
                      <li key={feed.id} className="rounded-md border border-slate-800 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-100">{feed.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge>
                              {feed.last_status === "success" ? "已更新" : "待刷新"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 px-0"
                              onClick={() => handleRefreshFeed(feed.id)}
                              disabled={refreshingFeedId === feed.id}
                              aria-label={`刷新 ${feed.name}`}
                            >
                              {refreshingFeedId === feed.id ? (
                                <span className="text-xs">...</span>
                              ) : (
                                <svg
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                  <polyline points="22 3 21 8 16 7" />
                                </svg>
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{feed.url}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={activeTab === "latest" ? "default" : "outline"}
                  onClick={() => setActiveTab("latest")}
                >
                  最新摘要
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "readLater" ? "default" : "outline"}
                  onClick={() => setActiveTab("readLater")}
                >
                  稍后再读
                </Button>
              </div>
              <div className="text-sm text-slate-400">
                {activeCountLabel}
              </div>
            </CardContent>
          </Card>

          {activeTab === "latest" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-400">
                  第 {itemsMeta.page} / {totalPages} 页 · 每页 {itemsMeta.pageSize} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={itemsMeta.page <= 1}
                    onClick={() => setItemsMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    上一页
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={itemsMeta.page >= totalPages}
                    onClick={() => setItemsMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    下一页
                  </Button>
                </div>
              </div>

              {items.length === 0 && (
                <Card>
                  <CardContent>
                    <p className="text-sm text-slate-400">暂无内容，请先添加站点。</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-slate-800">{item.feed_name}</Badge>
                        {item.category && <Badge className="bg-slate-700">{item.category}</Badge>}
                        {item.published_at && (
                          <span className="text-xs text-slate-400">
                            {new Date(item.published_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-semibold text-slate-50 hover:underline"
                      >
                        {item.title}
                      </a>
                      <p className="text-sm text-slate-300">{item.summary || "暂无摘要"}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant={readLaterItemIds.has(item.id) ? "secondary" : "outline"}
                          onClick={() => handleAddReadLater(item.id)}
                          disabled={readLaterItemIds.has(item.id)}
                        >
                          {readLaterItemIds.has(item.id) ? "已加入稍后再读" : "稍后再读"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {activeTab === "readLater" && (
            <section className="space-y-4">
              {readLaterEntries.length === 0 && (
                <Card>
                  <CardContent>
                    <p className="text-sm text-slate-400">暂无稍后再读内容。</p>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-4">
                {readLaterEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-slate-800">{entry.feed_name}</Badge>
                        {entry.category && <Badge className="bg-slate-700">{entry.category}</Badge>}
                        <span className="text-xs text-slate-400">
                          保存于 {new Date(entry.saved_at).toLocaleString()}
                        </span>
                      </div>
                      <a
                        href={entry.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-semibold text-slate-50 hover:underline"
                      >
                        {entry.title}
                      </a>
                      <p className="text-sm text-slate-300">{entry.summary || "暂无摘要"}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveReadLater(entry.item_id)}>
                          移除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

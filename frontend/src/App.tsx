import { useEffect, useMemo, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Input } from "./components/ui/input";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [categoryName, setCategoryName] = useState("");
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedCategory, setFeedCategory] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") {
      return items;
    }
    return items.filter((item) => item.category_id === selectedCategory);
  }, [items, selectedCategory]);

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

  const loadAll = async () => {
    setLoading(true);
    try {
      const ensureArray = <T,>(data: T[] | null) => (Array.isArray(data) ? data : []);
      const [categoryRes, feedRes, itemRes] = await Promise.all([
        fetch(`${API_BASE}/api/categories`),
        fetch(`${API_BASE}/api/feeds`),
        fetch(`${API_BASE}/api/items`),
      ]);
      if (categoryRes.ok) {
        const data = (await categoryRes.json()) as Category[] | null;
        setCategories(ensureArray(data));
      }
      if (feedRes.ok) {
        const data = (await feedRes.json()) as Feed[] | null;
        setFeeds(ensureArray(data));
      }
      if (itemRes.ok) {
        const data = (await itemRes.json()) as Item[] | null;
        setItems(ensureArray(data));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

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
    await loadAll();
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
    await loadAll();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">To-Reads RSS 阅读器</h1>
            <p className="text-sm text-slate-400">聚合 RSS / Atom / JSON Feed，按分类查看最新摘要。</p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadAll} disabled={loading}>
            {loading ? "刷新中..." : "刷新内容"}
          </Button>
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
                  onClick={() => setSelectedCategory("all")}
                >
                  全部
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category.id)}
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
                          <Badge>
                            {feed.last_status === "success" ? "已更新" : "待刷新"}
                          </Badge>
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">最新摘要</h2>
            <span className="text-sm text-slate-400">{filteredItems.length} 条</span>
          </div>
          <div className="space-y-4">
            {filteredItems.length === 0 && (
              <Card>
                <CardContent>
                  <p className="text-sm text-slate-400">暂无内容，请先添加站点。</p>
                </CardContent>
              </Card>
            )}
            {filteredItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-2">
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

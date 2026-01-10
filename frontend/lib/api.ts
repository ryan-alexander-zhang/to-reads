import type { Category, Feed, ItemsResponse } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>> & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "请求失败");
  }

  return body.data as T;
}

export const api = {
  listCategories: () => request<Category[]>("/categories"),
  createCategory: (payload: { name: string }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: number) =>
    request<{ status: string }>(`/categories/${id}`, { method: "DELETE" }),
  listFeeds: (categoryId?: number | null) => {
    const query = categoryId ? `?category_id=${categoryId}` : "";
    return request<Feed[]>(`/feeds${query}`);
  },
  createFeed: (payload: { name: string; url: string; category_id?: number | null }) =>
    request<Feed>("/feeds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateFeed: (id: number, payload: { name?: string; category_id?: number | null }) =>
    request<Feed>(`/feeds/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteFeed: (id: number) => request<{ status: string }>(`/feeds/${id}`, { method: "DELETE" }),
  listItems: (params: {
    page: number;
    page_size: number;
    category_id?: number | null;
    feed_id?: number | null;
    q?: string;
    unread?: boolean;
    favorite?: boolean;
  }) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page));
    query.set("page_size", String(params.page_size));
    if (params.category_id) query.set("category_id", String(params.category_id));
    if (params.feed_id) query.set("feed_id", String(params.feed_id));
    if (params.q) query.set("q", params.q);
    if (params.unread) query.set("unread", "true");
    if (params.favorite) query.set("favorite", "true");
    return request<ItemsResponse>(`/items?${query.toString()}`);
  },
  updateItemRead: (id: number, payload: { read: boolean }) =>
    request<{ status: string }>(`/items/${id}/read`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  batchRead: (payload: { item_ids: number[]; read: boolean }) =>
    request<{ status: string }>("/items/read-batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateItemFavorite: (id: number, payload: { favorite: boolean }) =>
    request<{ status: string }>(`/items/${id}/favorite`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  unreadCount: (params: { category_id?: number | null; feed_id?: number | null }) => {
    const query = new URLSearchParams();
    if (params.category_id) query.set("category_id", String(params.category_id));
    if (params.feed_id) query.set("feed_id", String(params.feed_id));
    return request<{ unread: number }>(`/items/unread-count?${query.toString()}`);
  },
};

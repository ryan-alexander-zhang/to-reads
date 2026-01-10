"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import DeleteForeverOutlineRoundedIcon from "@/components/icons/delete-forever-outline-rounded-icon";
import RefreshRoundedIcon from "@/components/icons/refresh-rounded-icon";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Category, Feed } from "@/lib/types";
import { categorySchema, feedSchema, type CategoryFormValues, type FeedFormValues } from "@/lib/validators";

type FeedManagerProps = {
  selectedCategory: number | null;
  selectedFeed: number | null;
  onSelectCategory: (id: number | null) => void;
  onSelectFeed: (id: number | null) => void;
};

export function FeedManager({
  selectedCategory,
  selectedFeed,
  onSelectCategory,
  onSelectFeed,
}: FeedManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.listCategories,
  });

  const { data: feeds = [], isLoading: feedsLoading } = useQuery({
    queryKey: queryKeys.feeds(selectedCategory),
    queryFn: () => api.listFeeds(selectedCategory),
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });

  const feedForm = useForm<FeedFormValues>({
    resolver: zodResolver(feedSchema),
    defaultValues: { name: "", url: "", category_id: selectedCategory ?? null },
  });

  useEffect(() => {
    feedForm.setValue("category_id", selectedCategory ?? null);
  }, [selectedCategory, feedForm]);

  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories) ?? [];
      const optimistic: Category = {
        id: Date.now(),
        name: payload.name,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKeys.categories, [...previous, optimistic]);
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories, context.previous);
      }
      toast({ title: "分类创建失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      toast({ title: "分类已添加" });
      categoryForm.reset({ name: "" });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: api.deleteCategory,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories) ?? [];
      queryClient.setQueryData(
        queryKeys.categories,
        previous.filter((category) => category.id !== id)
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories, context.previous);
      }
      toast({ title: "分类删除失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "分类已删除" });
    },
  });

  const createFeed = useMutation({
    mutationFn: api.createFeed,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds(selectedCategory) });
      const previous = queryClient.getQueryData<Feed[]>(queryKeys.feeds(selectedCategory)) ?? [];
      const optimistic: Feed = {
        id: Date.now(),
        name: payload.name,
        url: payload.url,
        category_id: payload.category_id ?? null,
        fetch_interval_minutes: 60,
        last_fetched_at: null,
        last_status: null,
        last_error: null,
        category_name: categories.find((category) => category.id === payload.category_id)?.name ?? null,
      };
      queryClient.setQueryData(queryKeys.feeds(selectedCategory), [...previous, optimistic]);
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.feeds(selectedCategory), context.previous);
      }
      toast({ title: "站点添加失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "站点已添加" });
      feedForm.reset({ name: "", url: "", category_id: selectedCategory ?? null });
    },
  });

  const updateFeed = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; category_id?: number | null } }) =>
      api.updateFeed(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds() });
      const previousAll = queryClient.getQueriesData<Feed[]>({ queryKey: ["feeds"] });
      previousAll.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData(
          key,
          data.map((feed) =>
            feed.id === id
              ? {
                  ...feed,
                  name: payload.name ?? feed.name,
                  category_id:
                    payload.category_id === 0
                      ? null
                      : payload.category_id ?? feed.category_id,
                }
              : feed
          )
        );
      });
      return { previousAll };
    },
    onError: (_error, _payload, context) => {
      context?.previousAll.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "站点更新失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "站点已更新" });
    },
  });

  const deleteFeed = useMutation({
    mutationFn: api.deleteFeed,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds() });
      const previousAll = queryClient.getQueriesData<Feed[]>({ queryKey: ["feeds"] });
      previousAll.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData(
          key,
          data.filter((feed) => feed.id !== id)
        );
      });
      return { previousAll };
    },
    onError: (_error, _payload, context) => {
      context?.previousAll.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "站点删除失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "站点已删除" });
    },
  });

  const refreshFeed = useMutation({
    mutationFn: api.refreshFeed,
    onError: () => {
      toast({ title: "站点刷新失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast({ title: "站点已刷新" });
    },
  });

  return (
    <aside className="space-y-6 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">订阅源管理</h2>
        <p className="text-sm text-muted-foreground">添加、删除和分类 RSS 站点</p>
      </div>

      <form
        onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))}
        className="space-y-3"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="category-name">
            新建分类
          </label>
          <Input id="category-name" placeholder="例如：技术 / 设计" {...categoryForm.register("name")} />
        </div>
        <Button type="submit" size="sm" disabled={createCategory.isPending}>
          添加分类
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">分类列表</h3>
          <Button variant="ghost" size="sm" onClick={() => onSelectCategory(null)}>
            全部
          </Button>
        </div>
        <div className="space-y-2">
          {categoriesLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无分类</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={`text-left text-sm ${
                    selectedCategory === category.id ? "font-semibold text-primary" : ""
                  }`}
                  onClick={() => onSelectCategory(category.id)}
                >
                  {category.name}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCategory.mutate(category.id)}
                  aria-label={`删除分类 ${category.name}`}
                >
                  删除
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={feedForm.handleSubmit((values) => createFeed.mutate(values))}
        className="space-y-3"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feed-name">
            站点名称
          </label>
          <Input id="feed-name" placeholder="站点名称" {...feedForm.register("name")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feed-url">
            Feed URL
          </label>
          <Input id="feed-url" placeholder="https://example.com/feed.xml" {...feedForm.register("url")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feed-category">
            归属分类
          </label>
          <select
            id="feed-category"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={feedForm.watch("category_id") ?? ""}
            onChange={(event) =>
              feedForm.setValue(
                "category_id",
                event.target.value ? Number(event.target.value) : null
              )
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
        <Button type="submit" size="sm" disabled={createFeed.isPending}>
          添加站点
        </Button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">站点列表</h3>
        {feedsLoading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无站点</p>
        ) : (
          <ul className="space-y-3">
            {feeds.map((feed) => (
              <li key={feed.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className={`text-left ${
                      selectedFeed === feed.id ? "font-semibold text-primary" : ""
                    }`}
                    onClick={() => onSelectFeed(feed.id)}
                  >
                    {feed.name}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => refreshFeed.mutate(feed.id)}
                      aria-label={`刷新站点 ${feed.name}`}
                      disabled={refreshFeed.isPending && refreshFeed.variables === feed.id}
                    >
                      <RefreshRoundedIcon size={18} color="currentColor" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => deleteFeed.mutate(feed.id)}
                      aria-label={`删除站点 ${feed.name}`}
                      disabled={deleteFeed.isPending && deleteFeed.variables === feed.id}
                    >
                      <DeleteForeverOutlineRoundedIcon size={18} color="currentColor" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{feed.url}</p>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                    value={feed.category_id ?? ""}
                    onChange={(event) =>
                      updateFeed.mutate({
                        id: feed.id,
                        payload: {
                          category_id: event.target.value ? Number(event.target.value) : 0,
                        },
                      })
                    }
                    aria-label={`调整站点 ${feed.name} 分类`}
                  >
                    <option value="">未分类</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

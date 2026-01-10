"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Plus, RefreshCw, SquarePen, Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Category, Feed } from "@/lib/types";
import { categorySchema, feedSchema, type CategoryFormValues, type FeedFormValues } from "@/lib/validators";

type FeedManagerProps = {
  selectedCategory: string | null;
  selectedFeed: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectFeed: (id: string | null) => void;
};

function FeedUnreadCount({ feedId }: { feedId: string }) {
  const { data } = useQuery({
    queryKey: queryKeys.unreadCount({ feedId }),
    queryFn: () => api.unreadCount({ feed_id: feedId }),
  });

  if (!data) return null;

  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
      Unread {data.unread}
    </span>
  );
}

export function FeedManager({
  selectedCategory,
  selectedFeed,
  onSelectCategory,
  onSelectFeed,
}: FeedManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [editFeedId, setEditFeedId] = useState<string | null>(null);

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

  const editFeedForm = useForm<{ name: string; category_id: string | null }>({
    defaultValues: { name: "", category_id: null },
  });

  const editFeed = useMemo(
    () => feeds.find((feed) => feed.id === editFeedId) ?? null,
    [editFeedId, feeds]
  );

  useEffect(() => {
    feedForm.setValue("category_id", selectedCategory ?? null);
  }, [selectedCategory, feedForm]);

  useEffect(() => {
    if (categoryDialogOpen) {
      categoryForm.reset({ name: "" });
    }
  }, [categoryDialogOpen, categoryForm]);

  useEffect(() => {
    if (feedDialogOpen) {
      feedForm.reset({ name: "", url: "", category_id: selectedCategory ?? null });
    }
  }, [feedDialogOpen, feedForm, selectedCategory]);

  useEffect(() => {
    if (!editFeed) return;
    editFeedForm.reset({ name: editFeed.name, category_id: editFeed.category_id ?? null });
  }, [editFeed, editFeedForm]);

  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories) ?? [];
      const optimistic: Category = {
        id: String(Date.now()),
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
      toast({ title: "Failed to create category" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      toast({ title: "Category added" });
      categoryForm.reset({ name: "" });
      setCategoryDialogOpen(false);
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
      toast({ title: "Failed to delete category" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "Category deleted" });
    },
  });

  const createFeed = useMutation({
    mutationFn: api.createFeed,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds(selectedCategory) });
      const previous = queryClient.getQueryData<Feed[]>(queryKeys.feeds(selectedCategory)) ?? [];
      const optimisticId = String(Date.now());
      const optimistic: Feed = {
        id: optimisticId,
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
      return { previous, optimisticId };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.feeds(selectedCategory), context.previous);
      }
      toast({ title: "Failed to add site" });
    },
    onSuccess: (createdFeed, _payload, context) => {
      if (context?.optimisticId) {
        queryClient.setQueriesData<Feed[]>({ queryKey: ["feeds"] }, (data) => {
          if (!data) return data;
          return data.map((feed) =>
            feed.id === context.optimisticId ? { ...feed, ...createdFeed } : feed
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "Site added" });
      feedForm.reset({ name: "", url: "", category_id: selectedCategory ?? null });
      setFeedDialogOpen(false);
    },
  });

  const updateFeed = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; category_id?: string | null } }) =>
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
                    payload.category_id === null || payload.category_id === ""
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
      toast({ title: "Failed to update site" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "Site updated" });
      setEditFeedId(null);
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
      toast({ title: "Failed to delete site" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "Site deleted" });
    },
  });

  const refreshFeed = useMutation({
    mutationFn: api.refreshFeed,
    onError: () => {
      toast({ title: "Failed to refresh site" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      toast({ title: "Site refreshed" });
    },
  });


  return (
    <aside className="space-y-6 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Subscription manager</h2>
        <p className="text-sm text-muted-foreground">Add, remove, and categorize RSS sites</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Category list</h3>
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Add category"
              >
                <FolderPlus className="h-[18px] w-[18px]" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add category</DialogTitle>
                <DialogDescription>Enter a new category name.</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={categoryForm.handleSubmit((values) => createCategory.mutate(values))}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Input
                    id="category-name"
                    placeholder="e.g. Technology / Design"
                    {...categoryForm.register("name")}
                  />
                  {categoryForm.formState.errors.name ? (
                    <p className="text-xs text-destructive">{categoryForm.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button type="submit" size="sm" disabled={createCategory.isPending}>
                    Add
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {categoriesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={`text-left text-sm ${
                    selectedCategory === category.id ? "font-semibold text-primary" : ""
                  }`}
                  onClick={() =>
                    onSelectCategory(selectedCategory === category.id ? null : category.id)
                  }
                >
                  {category.name}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => deleteCategory.mutate(category.id)}
                  aria-label={`Delete category ${category.name}`}
                >
                  <Trash className="h-[18px] w-[18px]" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Site list</h3>
          <Dialog open={feedDialogOpen} onOpenChange={setFeedDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Add site"
              >
                <Plus className="h-[18px] w-[18px]" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add site</DialogTitle>
                <DialogDescription>Enter site details and choose a category.</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={feedForm.handleSubmit((values) => createFeed.mutate(values))}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="feed-name">
                    Site name
                  </label>
                  <Input id="feed-name" placeholder="Site name" {...feedForm.register("name")} />
                  {feedForm.formState.errors.name ? (
                    <p className="text-xs text-destructive">{feedForm.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="feed-url">
                    Feed URL
                  </label>
                  <Input
                    id="feed-url"
                    placeholder="https://example.com/feed.xml"
                    {...feedForm.register("url")}
                  />
                  {feedForm.formState.errors.url ? (
                    <p className="text-xs text-destructive">{feedForm.formState.errors.url.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="feed-category">
                    Category
                  </label>
                  <select
                    id="feed-category"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={feedForm.watch("category_id") ?? ""}
                    onChange={(event) =>
                      feedForm.setValue(
                        "category_id",
                        event.target.value ? event.target.value : null
                      )
                    }
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter>
                  <Button type="submit" size="sm" disabled={createFeed.isPending}>
                    Add
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {feedsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sites</p>
        ) : (
          <ul className="space-y-3">
            {feeds.map((feed) => (
              <li key={feed.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={`text-left ${
                        selectedFeed === feed.id ? "font-semibold text-primary" : ""
                      }`}
                      onClick={() => onSelectFeed(feed.id)}
                    >
                      {feed.name}
                    </button>
                    <FeedUnreadCount feedId={feed.id} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Dialog
                      open={editFeedId === feed.id}
                      onOpenChange={(open) => setEditFeedId(open ? feed.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit site ${feed.name}`}
                        >
                          <SquarePen className="h-[18px] w-[18px]" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit site</DialogTitle>
                          <DialogDescription>Update the site name and category.</DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={editFeedForm.handleSubmit((values) =>
                            updateFeed.mutate({
                              id: feed.id,
                              payload: {
                                name: values.name,
                                category_id: values.category_id ?? "",
                              },
                            })
                          )}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor={`edit-feed-name-${feed.id}`}>
                              Site name
                            </label>
                            <Input
                              id={`edit-feed-name-${feed.id}`}
                              placeholder="Site name"
                              {...editFeedForm.register("name", { required: true })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor={`edit-feed-category-${feed.id}`}>
                              Category
                            </label>
                            <select
                              id={`edit-feed-category-${feed.id}`}
                              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                              value={editFeedForm.watch("category_id") ?? ""}
                              onChange={(event) =>
                                editFeedForm.setValue(
                                  "category_id",
                                  event.target.value ? event.target.value : null
                                )
                              }
                            >
                              <option value="">Uncategorized</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor={`edit-feed-url-${feed.id}`}>
                              Site URL
                            </label>
                            <Input id={`edit-feed-url-${feed.id}`} value={feed.url} disabled />
                          </div>
                          <DialogFooter>
                            <Button type="submit" size="sm" disabled={updateFeed.isPending}>
                              Save
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => refreshFeed.mutate(feed.id)}
                      aria-label={`Refresh site ${feed.name}`}
                      disabled={refreshFeed.isPending && refreshFeed.variables === feed.id}
                    >
                      <RefreshCw className="h-[18px] w-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => deleteFeed.mutate(feed.id)}
                      aria-label={`Delete site ${feed.name}`}
                      disabled={deleteFeed.isPending && deleteFeed.variables === feed.id}
                    >
                      <Trash className="h-[18px] w-[18px]" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

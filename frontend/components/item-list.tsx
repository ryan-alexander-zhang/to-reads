"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";

import { ItemCard } from "@/components/item-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ItemsResponse } from "@/lib/types";

type ItemListProps = {
  categoryId: number | null;
  feedId: number | null;
  search: string;
  unreadOnly: boolean;
  favoriteOnly: boolean;
};

type ItemsInfiniteData = InfiniteData<ItemsResponse>;
type ItemsQueryTuple = [QueryKey, ItemsInfiniteData | undefined];

const PAGE_SIZE = 20;

export function ItemList({ categoryId, feedId, search, unreadOnly, favoriteOnly }: ItemListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  const params = useMemo(
    () => ({
      category_id: categoryId ?? undefined,
      feed_id: feedId ?? undefined,
      q: search || undefined,
      unread: unreadOnly || undefined,
      favorite: favoriteOnly || undefined,
      page_size: PAGE_SIZE,
    }),
    [categoryId, feedId, search, unreadOnly, favoriteOnly]
  );

  const itemsQuery = useInfiniteQuery<ItemsResponse>({
    queryKey: queryKeys.items(params),
    queryFn: ({ pageParam }) =>
      api.listItems({ ...params, page: pageParam as number, page_size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.page_size);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  const allItems = itemsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const rowVirtualizer = useVirtualizer({
    count: itemsQuery.hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 6,
  });

  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= allItems.length - 1 && itemsQuery.hasNextPage && !itemsQuery.isFetchingNextPage) {
      itemsQuery.fetchNextPage();
    }
  }, [allItems.length, itemsQuery, rowVirtualizer]);

  const updateRead = useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) => api.updateItemRead(id, { read }),
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueriesData<ItemsInfiniteData>({ queryKey: ["items"] }) as ItemsQueryTuple[];
      previous.forEach(([key, data]) => {
        if (!data) return;
          queryClient.setQueryData<ItemsInfiniteData>(key, {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === id ? { ...item, is_read: read } : item)),
            })),
          });
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "更新已读状态失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount({ categoryId, feedId }) });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const updateFavorite = useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      api.updateItemFavorite(id, { favorite }),
    onMutate: async ({ id, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueriesData<ItemsInfiniteData>({ queryKey: ["items"] }) as ItemsQueryTuple[];
      previous.forEach(([key, data]) => {
        if (!data) return;
          queryClient.setQueryData<ItemsInfiniteData>(key, {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === id ? { ...item, is_favorite: favorite } : item)),
            })),
          });
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "更新收藏状态失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const batchRead = useMutation({
    mutationFn: ({ itemIds, read }: { itemIds: number[]; read: boolean }) =>
      api.batchRead({ item_ids: itemIds, read }),
    onMutate: async ({ itemIds, read }) => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueriesData<ItemsInfiniteData>({ queryKey: ["items"] }) as ItemsQueryTuple[];
      previous.forEach(([key, data]) => {
        if (!data) return;
          queryClient.setQueryData<ItemsInfiniteData>(key, {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (itemIds.includes(item.id) ? { ...item, is_read: read } : item)),
            })),
          });
      });
      return { previous };
    },
    onError: (_error, _payload, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "批量更新失败" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount({ categoryId, feedId }) });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({ title: "已批量更新" });
    },
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">文章列表</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => batchRead.mutate({ itemIds: allItems.map((item) => item.id), read: true })}
          disabled={allItems.length === 0}
        >
          当前列表全部已读
        </Button>
      </div>

      {itemsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          暂无文章，请添加订阅或调整筛选条件。
        </div>
      ) : (
        <div
          ref={parentRef}
          className="h-[700px] overflow-auto rounded-lg border border-border p-4"
        >
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index > allItems.length - 1;
              const item = allItems[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {isLoaderRow ? (
                    <div className="py-2">
                      {itemsQuery.hasNextPage ? (
                        <Skeleton className="h-32 w-full" />
                      ) : (
                        <p className="text-center text-xs text-muted-foreground">没有更多内容了</p>
                      )}
                    </div>
                  ) : (
                    <div className="py-2">
                      <ItemCard
                        item={item}
                        onMarkRead={(currentItem) =>
                          updateRead.mutate({ id: currentItem.id, read: true })
                        }
                        onToggleFavorite={(currentItem) =>
                          updateFavorite.mutate({
                            id: currentItem.id,
                            favorite: !currentItem.is_favorite,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

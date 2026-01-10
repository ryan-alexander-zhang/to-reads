"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type UnreadCountProps = {
  categoryId: number | null;
  feedId: number | null;
};

export function UnreadCount({ categoryId, feedId }: UnreadCountProps) {
  const { data } = useQuery({
    queryKey: queryKeys.unreadCount({ categoryId, feedId }),
    queryFn: () => api.unreadCount({ category_id: categoryId, feed_id: feedId }),
  });

  return (
    <Badge variant="outline" className="border-primary text-primary">
      Unread {data?.unread ?? 0}
    </Badge>
  );
}

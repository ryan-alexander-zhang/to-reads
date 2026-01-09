export const queryKeys = {
  categories: ["categories"] as const,
  feeds: (categoryId?: number | null) => ["feeds", { categoryId }] as const,
  items: (params: Record<string, unknown>) => ["items", params] as const,
  unreadCount: (params: Record<string, unknown>) => ["unread-count", params] as const,
};

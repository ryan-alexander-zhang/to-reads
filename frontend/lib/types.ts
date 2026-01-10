export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Feed = {
  id: string;
  name: string;
  url: string;
  category_id: string | null;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  last_status: string | null;
  last_error: string | null;
  category_name?: string | null;
};

export type Item = {
  id: string;
  feed_id: string;
  feed_name: string;
  category_id: string | null;
  category: string | null;
  title: string;
  link: string;
  summary: string;
  published_at: string | null;
  is_read: boolean;
  is_favorite: boolean;
};

export type ItemsResponse = {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
};

export type TransferCategory = {
  id: string;
  name: string;
};

export type TransferFeed = {
  id: string;
  name: string;
  url: string;
  category_id: string | null;
  category_name: string | null;
};

export type TransferPayload = {
  categories: TransferCategory[];
  feeds: TransferFeed[];
};

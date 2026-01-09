export type Category = {
  id: number;
  name: string;
  created_at: string;
};

export type Feed = {
  id: number;
  name: string;
  url: string;
  category_id: number | null;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  last_status: string | null;
  last_error: string | null;
  category_name?: string | null;
};

export type Item = {
  id: number;
  feed_id: number;
  feed_name: string;
  category_id: number | null;
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

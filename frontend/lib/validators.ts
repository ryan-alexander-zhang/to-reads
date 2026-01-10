import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Please enter a category name"),
});

export const feedSchema = z.object({
  name: z.string().min(1, "Please enter a site name"),
  url: z.string().url("Please enter a valid URL"),
  category_id: z.number().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
export type FeedFormValues = z.infer<typeof feedSchema>;

import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "请输入分类名称"),
});

export const feedSchema = z.object({
  name: z.string().min(1, "请输入站点名称"),
  url: z.string().url("请输入合法的 URL"),
  category_id: z.number().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
export type FeedFormValues = z.infer<typeof feedSchema>;

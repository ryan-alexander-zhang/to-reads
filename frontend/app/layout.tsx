import "./globals.css";

import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "To-Reads RSS",
  description: "轻量级 RSS 阅读器",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="min-h-screen bg-background">
            <header className="border-b border-border">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div>
                  <h1 className="text-xl font-semibold">To-Reads</h1>
                  <p className="text-sm text-muted-foreground">订阅与阅读管理中心</p>
                </div>
                <ThemeToggle />
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

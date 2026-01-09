"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import * as React from "react";

import { cn } from "@/lib/utils";

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (message: Omit<ToastMessage, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const toast = React.useCallback((message: Omit<ToastMessage, "id">) => {
    setMessages((prev) => [{ ...message, id: crypto.randomUUID() }, ...prev]);
  }, []);

  const handleOpenChange = React.useCallback((id: string, open: boolean) => {
    if (!open) {
      setMessages((prev) => prev.filter((toastMessage) => toastMessage.id !== id));
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            className={cn(
              "relative rounded-md border border-border bg-card px-4 py-3 shadow-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out"
            )}
            onOpenChange={(open) => handleOpenChange(message.id, open)}
          >
            <ToastPrimitive.Title className="text-sm font-semibold">
              {message.title}
            </ToastPrimitive.Title>
            {message.description ? (
              <ToastPrimitive.Description className="text-sm text-muted-foreground">
                {message.description}
              </ToastPrimitive.Description>
            ) : null}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-6 right-6 flex w-80 flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

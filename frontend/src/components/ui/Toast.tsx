"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type Kind = "success" | "error";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

/** Returns `toast(message, kind?)`. */
export const useToast = () => useContext(ToastContext);

/** Renders transient notifications above the content. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={clsx(
              "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop animate-pop-in",
              t.kind === "error" ? "bg-danger-500 text-white" : "bg-ink text-canvas",
            )}
          >
            {t.kind === "error" ? <CircleAlert className="size-5 shrink-0" /> : <CheckCircle2 className="size-5 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

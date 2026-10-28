import clsx from "clsx";
import type { ReactNode } from "react";

/** Primary actions: pinned to the bottom of the screen on phones (thumb reach), inline on larger screens. */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 px-4 pt-3 pb-safe backdrop-blur-md",
        "sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1800px] justify-end gap-3">{children}</div>
    </div>
  );
}

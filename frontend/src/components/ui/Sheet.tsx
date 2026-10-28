"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./Button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal built on the native <dialog>: focus trapping, Esc to close and inert background come for free.
 * Presented as a bottom sheet on phones and as a centred dialog from the `sm` breakpoint up.
 */
export function Sheet({ open, onClose, title, closeLabel, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <div
          className="flex h-full items-end justify-center sm:items-center sm:p-6"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-pop animate-sheet-up sm:max-w-lg sm:rounded-3xl sm:animate-pop-in">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-2 px-5 pb-1 pt-3">
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              <IconButton label={closeLabel} onClick={onClose} className="-mr-2">
                <X className="size-5" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">{children}</div>
            {footer && <div className="px-5 pb-safe pt-2">{footer}</div>}
          </div>
        </div>
      )}
    </dialog>
  );
}

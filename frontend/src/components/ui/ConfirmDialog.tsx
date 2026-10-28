"use client";

import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for destructive actions. */
export function ConfirmDialog({ open, title, message, confirmLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const t = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      closeLabel={t("close")}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-ink-soft">{message}</p>
    </Sheet>
  );
}

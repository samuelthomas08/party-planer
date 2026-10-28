"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ACCEPTED_IMAGE_TYPES, UnsupportedImageError, uploadImage } from "@/lib/images";
import { errorKey } from "@/lib/errors";
import { useToast } from "./Toast";

interface Props {
  onUploaded: (imageId: string) => void;
  maxSizeMB: number;
  maxDimension: number;
  children: ReactNode;
  className?: string;
}

/**
 * A button-styled <label> around a file input. On phones the OS offers camera or gallery.
 * The picked image is shrunk in the browser and uploaded straight away.
 */
export function ImageUploadButton({ onUploaded, maxSizeMB, maxDimension, children, className }: Props) {
  const t = useTranslations();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await uploadImage(file, { maxSizeMB, maxDimension }));
    } catch (err) {
      toast(err instanceof UnsupportedImageError ? t("errors.IMAGE_UNSUPPORTED") : t(`errors.${errorKey(err)}`), "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <label
      className={clsx(
        "relative inline-flex cursor-pointer items-center justify-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0])}
        disabled={busy}
      />
      {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </label>
  );
}

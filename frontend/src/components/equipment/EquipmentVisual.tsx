import clsx from "clsx";
import { ImageOff } from "lucide-react";
import { imageUrl } from "@/lib/api";
import type { Equipment } from "@/lib/types";
import { StandPreview } from "./StandPreview";

/** Picture of a piece of equipment: the assembled stand or the single photo. */
export function EquipmentVisual({ equipment, className }: { equipment: Pick<Equipment, "category" | "images">; className?: string }) {
  if (equipment.category === "STAND") {
    return <StandPreview images={equipment.images} className={className} />;
  }
  const src = imageUrl(equipment.images.PHOTO);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={clsx("mx-auto max-h-full max-w-full object-contain", className)} />
  ) : (
    <ImageOff className="mx-auto size-8 text-ink-faint" aria-hidden />
  );
}

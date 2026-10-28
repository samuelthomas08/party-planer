"use client";

import { Camera, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { imageUrl } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { useEquipmentMutations } from "@/lib/queries";
import type { Equipment, EquipmentCategory, EquipmentImages, EquipmentSlot } from "@/lib/types";
import { StickyActions } from "../layout/StickyActions";
import { Button } from "../ui/Button";
import { TextArea, TextInput } from "../ui/Field";
import { ImageUploadButton } from "../ui/ImageUploadButton";
import { Card, ErrorNote, Segmented } from "../ui/misc";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { StandPreview } from "./StandPreview";

/** Create / edit form. Stands are assembled slot by slot; other equipment has one photo. Images upload immediately and are referenced by id. */
export function EquipmentForm({ initial }: { initial?: Equipment }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { create, update } = useEquipmentMutations();

  const [category, setCategory] = useState<EquipmentCategory>(initial?.category ?? "STAND");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [images, setImages] = useState<EquipmentImages>(initial?.images ?? {});
  const [activeSlot, setActiveSlot] = useState<EquipmentSlot | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const saving = create.isPending || update.isPending;
  const photoMissing = category === "OTHER" && !images.PHOTO;
  const titleMissing = title.trim() === "";

  const setSlot = (slot: EquipmentSlot, id: string | undefined) =>
    setImages((prev) => {
      const next = { ...prev };
      if (id) next[slot] = id;
      else delete next[slot];
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (titleMissing || photoMissing) return;

    // Only send slots that belong to the chosen category (switching category keeps old picks in state).
    const relevant = Object.fromEntries(
      Object.entries(images).filter(([slot]) => (slot === "PHOTO") === (category === "OTHER")),
    ) as EquipmentImages;
    const input = { title: title.trim(), description: description.trim(), category, images: relevant };

    try {
      if (initial) await update.mutateAsync({ id: initial.id, input });
      else await create.mutateAsync(input);
      log.info(initial ? "EQUIPMENT_SAVED_UPDATE" : "EQUIPMENT_SAVED_CREATE", category, { id: initial?.id });
      toast(t("equipment.saved"));
      router.push("/");
    } catch (err) {
      setError(err);
    }
  };

  const slotLabel = (slot: EquipmentSlot) => t(`equipment.slots.${slot}`);

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2" noValidate>
      <Card className="space-y-5 p-5">
        <Segmented
          label={t("equipment.type")}
          value={category}
          onChange={setCategory}
          options={[
            { value: "STAND", label: t("equipment.category.STAND") },
            { value: "OTHER", label: t("equipment.category.OTHER") },
          ]}
        />
        <TextInput
          label={t("equipment.name")}
          placeholder={t("equipment.namePlaceholder")}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          error={submitted && titleMissing ? t("common.required") : undefined}
          required
        />
        <TextArea
          label={t("equipment.description")}
          placeholder={t("equipment.descriptionPlaceholder")}
          value={description}
          maxLength={4000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Card>

      <Card className="p-5">
        <h2 className="font-bold">{category === "STAND" ? t("equipment.partsTitle") : t("equipment.photoTitle")}</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {category === "STAND" ? t("equipment.partsHint") : t("equipment.photoHint")}
        </p>

        {category === "STAND" ? (
          <div className="mx-auto max-w-sm">
            <StandPreview images={images} onSlotClick={setActiveSlot} slotLabel={slotLabel} />
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setActiveSlot("PHOTO")}
              className={`flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-card border-2 border-dashed bg-sunken/60 transition-colors hover:border-brand-500 ${
                submitted && photoMissing ? "border-danger-500" : "border-line-strong"
              }`}
              aria-label={t("equipment.slots.PHOTO")}
            >
              {images.PHOTO ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl(images.PHOTO)} alt="" className="size-full object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 font-semibold text-brand-600 dark:text-brand-300">
                  <Camera className="size-7" />
                  {t("equipment.addPhoto")}
                </span>
              )}
            </button>
            {submitted && photoMissing && <ErrorNote>{t("equipment.photoRequired")}</ErrorNote>}
          </div>
        )}
      </Card>

      {error != null && (
        <div className="lg:col-span-2">
          <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
        </div>
      )}

      <StickyActions className="lg:col-span-2">
        <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto sm:min-w-48">
          {t("common.save")}
        </Button>
      </StickyActions>

      <Sheet
        open={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        title={activeSlot ? slotLabel(activeSlot) : ""}
        closeLabel={t("common.close")}
      >
        {activeSlot && (
          <div className="space-y-4 pb-2">
            {images[activeSlot] && (
              <div className="flex h-48 items-center justify-center rounded-card bg-sunken p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(images[activeSlot])} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <ImageUploadButton
              maxSizeMB={activeSlot === "PHOTO" ? 0.7 : 0.15}
              maxDimension={activeSlot === "PHOTO" ? 1200 : 800}
              onUploaded={(id) => {
                setSlot(activeSlot, id);
                setActiveSlot(null);
              }}
              className="h-12 w-full rounded-control bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
            >
              <Camera className="size-5" />
              {images[activeSlot] ? t("equipment.replaceImage") : t("equipment.chooseImage")}
            </ImageUploadButton>
            {images[activeSlot] && (
              <Button
                variant="secondary"
                full
                icon={<Trash2 className="size-5" />}
                onClick={() => {
                  setSlot(activeSlot, undefined);
                  setActiveSlot(null);
                }}
              >
                {t("equipment.removeImage")}
              </Button>
            )}
            <p className="text-center text-xs text-ink-faint">{t("equipment.imageFormats")}</p>
          </div>
        )}
      </Sheet>
    </form>
  );
}

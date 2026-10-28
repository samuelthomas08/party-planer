"use client";

import clsx from "clsx";
import { ImagePlus, MapPinPlus, Replace } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { MARKER_COLORS, uid } from "@/lib/color";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { useEquipment, useFolderMutations, useFolders, usePlaceMutations } from "@/lib/queries";
import type { Place, Placement } from "@/lib/types";
import { StickyActions } from "../layout/StickyActions";
import { Button } from "../ui/Button";
import { Select, TextInput } from "../ui/Field";
import { ImageUploadButton } from "../ui/ImageUploadButton";
import { Card, ErrorNote } from "../ui/misc";
import { useToast } from "../ui/Toast";
import { FloorPlan } from "./FloorPlan";
import { MarkerEditPanel } from "./MarkerPanel";
import { MarkerList } from "./MarkerList";

const NEW_FOLDER = "__new__";

/** Create / edit form with the floor-plan editor. Markers that already exist on the server keep their id so the history can follow them. */
export function PlaceForm({ initial }: { initial?: Place }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { data: folders = [] } = useFolders();
  const { data: equipment = [] } = useEquipment();
  const folderOps = useFolderMutations();
  const placeOps = usePlaceMutations();

  const [knownIds] = useState(() => new Set(initial?.placements.map((p) => p.id) ?? []));
  const [name, setName] = useState(initial?.name ?? "");
  const [folderChoice, setFolderChoice] = useState<string>(initial?.folderId ?? "");
  const [newFolderName, setNewFolderName] = useState("");
  const [imageId, setImageId] = useState<string | null>(initial?.floorPlanImageId ?? null);
  const [placements, setPlacements] = useState<Placement[]>(initial?.placements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  // Without any folder yet, creating one is the only sensible choice.
  const choice = folderChoice || (folders.length === 0 ? NEW_FOLDER : folders[0]?.id ?? "");
  const creatingFolder = choice === NEW_FOLDER;

  const selectedIndex = placements.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? placements[selectedIndex] : null;

  const nameMissing = name.trim() === "";
  const folderMissing = creatingFolder && newFolderName.trim() === "";

  const patch = (id: string, change: Partial<Placement>) =>
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const addMarker = (x: number, y: number) => {
    const marker: Placement = {
      id: uid(),
      x,
      y,
      equipmentId: null,
      color: MARKER_COLORS[placements.length % MARKER_COLORS.length],
    };
    setPlacements((prev) => [...prev, marker]);
    setSelectedId(marker.id);
    setAddMode(false);
  };

  const removeMarker = (id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (nameMissing || folderMissing || !imageId) return;

    setSaving(true);
    try {
      const folderId = creatingFolder ? (await folderOps.create.mutateAsync(newFolderName.trim())).id : choice;
      const input = {
        name: name.trim(),
        folderId,
        floorPlanImageId: imageId,
        // Markers that came from the server keep their id, so the history can follow each one.
        placements: placements.map(({ id, x, y, equipmentId, color }) => ({
          id: knownIds.has(id) ? id : undefined,
          x,
          y,
          equipmentId,
          color,
        })),
      };
      const saved = initial
        ? await placeOps.update.mutateAsync({ id: initial.id, input })
        : await placeOps.create.mutateAsync(input);
      log.info(initial ? "PLACE_SAVED_UPDATE" : "PLACE_SAVED_CREATE", `${placements.length} markers`, { id: saved.id });
      toast(t("places.saved"));
      router.push(`/places/${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const markerLabel = (i: number) => (i < 0 ? t("places.tapToPlace") : t("places.markerTitle", { n: i + 1 }));

  return (
    <form onSubmit={submit} noValidate className={clsx("grid gap-6 lg:grid-cols-[1fr_22rem]", selected && "pb-[55dvh] lg:pb-0")}>
      <div className="min-w-0 space-y-6">
        <Card className="grid gap-5 p-5 sm:grid-cols-2">
          <TextInput
            label={t("places.name")}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            error={submitted && nameMissing ? t("common.required") : undefined}
            required
          />
          <div className="space-y-4">
            <Select label={t("places.folder")} value={choice} onChange={(e) => setFolderChoice(e.target.value)}>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value={NEW_FOLDER}>{t("places.newFolderOption")}</option>
            </Select>
            {creatingFolder && (
              <TextInput
                label={t("dashboard.folderName")}
                value={newFolderName}
                maxLength={100}
                onChange={(e) => setNewFolderName(e.target.value)}
                error={submitted && folderMissing ? t("common.required") : undefined}
              />
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-bold">{t("places.floorPlan")}</h2>
            {imageId && (
              <>
                <Button
                  variant={addMode ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={addMode}
                  icon={<MapPinPlus className="size-4" />}
                  onClick={() => {
                    setAddMode((m) => !m);
                    setSelectedId(null);
                  }}
                >
                  {addMode ? t("common.cancel") : t("places.addMarker")}
                </Button>
                <ImageUploadButton
                  maxSizeMB={1.5}
                  maxDimension={1800}
                  onUploaded={setImageId}
                  className="h-9 gap-1.5 rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-sunken"
                >
                  <Replace className="size-4" />
                  {t("places.changeImage")}
                </ImageUploadButton>
              </>
            )}
          </div>

          {imageId ? (
            <>
              <FloorPlan
                imageId={imageId}
                placements={placements}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setAddMode(false);
                }}
                editable
                addMode={addMode}
                onAdd={addMarker}
                onMove={(id, x, y) => patch(id, { x, y })}
                markerLabel={markerLabel}
                planLabel={t("places.floorPlan")}
              />
              <p className="mt-3 text-sm text-ink-faint">{t("places.editorHint")}</p>
              <MarkerList placements={placements} equipment={equipment} selectedId={selectedId} onSelect={setSelectedId} />
            </>
          ) : (
            <ImageUploadButton
              maxSizeMB={1.5}
              maxDimension={1800}
              onUploaded={setImageId}
              className={clsx(
                "flex min-h-56 w-full flex-col gap-2 rounded-card border-2 border-dashed bg-sunken/50 px-4 text-center font-semibold text-brand-600 transition-colors hover:border-brand-500 dark:text-brand-300",
                submitted ? "border-danger-500" : "border-line-strong",
              )}
            >
              <ImagePlus className="size-8" />
              {t("places.uploadPlan")}
              <span className="text-sm font-normal text-ink-faint">{t("equipment.imageFormats")}</span>
            </ImageUploadButton>
          )}
          {submitted && !imageId && <p role="alert" className="mt-2 text-sm text-danger-600 dark:text-danger-500">{t("places.planRequired")}</p>}
        </Card>

        {error != null && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}
      </div>

      {selected && (
        <MarkerEditPanel
          index={selectedIndex}
          placement={selected}
          equipment={equipment}
          onChange={(change) => patch(selected.id, change)}
          onDelete={() => removeMarker(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {!selected && (
        <StickyActions className="lg:col-span-2">
          <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto sm:min-w-48">
            {t("common.save")}
          </Button>
        </StickyActions>
      )}
    </form>
  );
}

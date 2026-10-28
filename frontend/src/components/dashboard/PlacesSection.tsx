"use client";

import { ChevronRight, FolderPlus, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { imageUrl } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { useFolderMutations, useFolders, usePlaceMutations } from "@/lib/queries";
import type { Folder, PlaceSummary } from "@/lib/types";
import { Button, ButtonLink, IconButton, IconLink } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TextInput } from "../ui/Field";
import { Card, EmptyState, ErrorNote, Spinner } from "../ui/misc";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

type FolderDialog = { mode: "create" } | { mode: "rename"; folder: Folder } | null;

/** Folders and their places, with folder create / rename / delete and place delete. */
export function PlacesSection() {
  const t = useTranslations();
  const toast = useToast();
  const { data: folders, isPending, error } = useFolders();
  const folderOps = useFolderMutations();
  const placeOps = usePlaceMutations();

  const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
  const [name, setName] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [placeToDelete, setPlaceToDelete] = useState<PlaceSummary | null>(null);

  const openDialog = (d: FolderDialog) => {
    setName(d?.mode === "rename" ? d.folder.name : "");
    setFolderDialog(d);
  };

  const submitFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!folderDialog || !name.trim()) return;
    try {
      if (folderDialog.mode === "create") await folderOps.create.mutateAsync(name.trim());
      else await folderOps.rename.mutateAsync({ id: folderDialog.folder.id, name: name.trim() });
      setFolderDialog(null);
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    }
  };

  const run = async (action: () => Promise<unknown>, done: string, close: () => void) => {
    try {
      await action();
      toast(done);
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    }
    close();
  };

  return (
    <section aria-labelledby="places-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="places-heading" className="text-xl font-extrabold tracking-tight">
          {t("dashboard.places")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<FolderPlus className="size-4" />} onClick={() => openDialog({ mode: "create" })}>
            {t("dashboard.newFolder")}
          </Button>
          <ButtonLink href="/places/new" size="sm" icon={<Plus className="size-4" />} className="hidden lg:inline-flex">
            {t("dashboard.newPlace")}
          </ButtonLink>
        </div>
      </div>

      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      ) : folders.length === 0 ? (
        <EmptyState icon={<MapPin className="size-6" />} title={t("dashboard.noPlaces")}>
          {t("dashboard.noPlacesHint")}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {folders.map((folder) => (
            <div key={folder.id}>
              <div className="mb-2 flex items-center gap-1">
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-widest text-ink-faint">{folder.name}</h3>
                <IconButton label={t("dashboard.renameFolder")} onClick={() => openDialog({ mode: "rename", folder })}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={t("dashboard.deleteFolder")} tone="danger" onClick={() => setFolderToDelete(folder)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>

              {folder.places.length === 0 ? (
                <p className="rounded-control border border-dashed border-line-strong px-4 py-4 text-sm text-ink-faint">
                  {t("dashboard.emptyFolder")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {folder.places.map((place) => (
                    <li key={place.id}>
                      <Card className="flex items-center gap-1 pr-1">
                        <Link href={`/places/${place.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-2.5">
                          <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-sunken">
                            {place.floorPlanImageId && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageUrl(place.floorPlanImageId)} alt="" className="size-full object-cover" loading="lazy" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-bold">{place.name}</span>
                          <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
                        </Link>
                        <IconLink href={`/places/${place.id}/edit`} label={t("dashboard.editNamed", { name: place.name })} tone="brand">
                          <Pencil className="size-5" />
                        </IconLink>
                        <IconButton label={t("dashboard.deleteNamed", { name: place.name })} tone="danger" onClick={() => setPlaceToDelete(place)}>
                          <Trash2 className="size-5" />
                        </IconButton>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet
        open={folderDialog !== null}
        onClose={() => setFolderDialog(null)}
        title={folderDialog?.mode === "rename" ? t("dashboard.renameFolder") : t("dashboard.newFolder")}
        closeLabel={t("common.close")}
      >
        <form onSubmit={submitFolder} className="space-y-4 pb-2">
          <TextInput
            label={t("dashboard.folderName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            required
          />
          <Button type="submit" full size="lg" loading={folderOps.create.isPending || folderOps.rename.isPending}>
            {folderDialog?.mode === "rename" ? t("common.save") : t("common.create")}
          </Button>
        </form>
      </Sheet>

      <ConfirmDialog
        open={folderToDelete !== null}
        title={t("dashboard.deleteFolder")}
        message={t("dashboard.deleteFolderMessage", { name: folderToDelete?.name ?? "", count: folderToDelete?.places.length ?? 0 })}
        confirmLabel={t("common.delete")}
        loading={folderOps.remove.isPending}
        onConfirm={() =>
          run(() => folderOps.remove.mutateAsync(folderToDelete!.id), t("dashboard.folderDeleted"), () => setFolderToDelete(null))
        }
        onCancel={() => setFolderToDelete(null)}
      />

      <ConfirmDialog
        open={placeToDelete !== null}
        title={t("dashboard.deletePlace")}
        message={t("dashboard.deletePlaceMessage", { name: placeToDelete?.name ?? "" })}
        confirmLabel={t("common.delete")}
        loading={placeOps.remove.isPending}
        onConfirm={() =>
          run(() => placeOps.remove.mutateAsync(placeToDelete!.id), t("dashboard.placeDeleted"), () => setPlaceToDelete(null))
        }
        onCancel={() => setPlaceToDelete(null)}
      />
    </section>
  );
}

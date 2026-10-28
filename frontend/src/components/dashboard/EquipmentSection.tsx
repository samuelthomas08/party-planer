"use client";

import { Package, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { errorKey } from "@/lib/errors";
import { useEquipment, useEquipmentMutations } from "@/lib/queries";
import type { Equipment } from "@/lib/types";
import { EquipmentCard } from "../equipment/EquipmentCard";
import { ButtonLink } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState, ErrorNote, Spinner } from "../ui/misc";
import { useToast } from "../ui/Toast";

/** Equipment grid with delete confirmation. */
export function EquipmentSection() {
  const t = useTranslations();
  const toast = useToast();
  const { data, isPending, error } = useEquipment();
  const { remove } = useEquipmentMutations();
  const [toDelete, setToDelete] = useState<Equipment | null>(null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast(t("equipment.deleted"));
    } catch (err) {
      toast(t(`errors.${errorKey(err)}`), "error");
    }
    setToDelete(null);
  };

  return (
    <section aria-labelledby="equipment-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="equipment-heading" className="text-xl font-extrabold tracking-tight">
          {t("dashboard.equipment")}
        </h2>
        <ButtonLink href="/equipment/new" size="sm" icon={<Plus className="size-4" />} className="hidden lg:inline-flex">
          {t("dashboard.newEquipment")}
        </ButtonLink>
      </div>

      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      ) : data.length === 0 ? (
        <EmptyState icon={<Package className="size-6" />} title={t("dashboard.noEquipment")}>
          {t("dashboard.noEquipmentHint")}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {data.map((item) => (
            <li key={item.id}>
              <EquipmentCard item={item} onDelete={setToDelete} />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t("equipment.deleteTitle")}
        message={t("equipment.deleteMessage", { name: toDelete?.title ?? "" })}
        confirmLabel={t("common.delete")}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

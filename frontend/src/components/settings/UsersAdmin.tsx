"use client";

import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronRight, Lock, MailPlus, Plus, ShieldCheck, UserX } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import { keys, useAdminUsers, useMe } from "@/lib/queries";
import type { AdminUser, Role } from "@/lib/types";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PasswordInput, TextInput } from "../ui/Field";
import { Badge, Card, ErrorNote, Segmented, Spinner } from "../ui/misc";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { InvitationsAdmin, InviteSheet } from "./InvitationsAdmin";

/** User list with a detail sheet for role, status, password reset and deletion, plus invitations. */
export function UsersAdmin() {
  const t = useTranslations();
  const format = useFormatter();
  const { data: users, isPending, error } = useAdminUsers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const selected = users?.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-ink-soft">{t("users.intro")}</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" icon={<MailPlus className="size-4" />} onClick={() => setInviting(true)}>
            {t("invite.button")}
          </Button>
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t("users.create")}
          </Button>
        </div>
      </div>

      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Card>
                <button type="button" onClick={() => setSelectedId(u.id)} className="flex w-full items-center gap-3 p-3.5 text-left">
                  <span
                    className={clsx(
                      "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      u.enabled ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-100" : "bg-sunken text-ink-faint",
                    )}
                  >
                    {u.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-bold">{u.displayName}</span>
                      {u.role === "ADMIN" && <Badge tone="party"><ShieldCheck className="mr-1 size-3" />{t("audit.role.ADMIN")}</Badge>}
                      {!u.enabled && <Badge tone="neutral"><UserX className="mr-1 size-3" />{t("users.disabled")}</Badge>}
                      {u.locked && <Badge tone="neutral"><Lock className="mr-1 size-3" />{t("users.locked")}</Badge>}
                    </span>
                    <span className="block truncate text-sm text-ink-soft">{u.email}</span>
                    <span className="block text-xs text-ink-faint">
                      {t("users.stats", { places: u.places, equipment: u.equipment })} · {t("users.since", { date: format.dateTime(new Date(u.createdAt), { dateStyle: "medium" }) })}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <InvitationsAdmin />
      <InviteSheet open={inviting} onClose={() => setInviting(false)} />
      <UserSheet user={selected} onClose={() => setSelectedId(null)} />
      <CreateUserSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function UserSheet({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const isSelf = user?.id === me?.id;
  const refresh = () => qc.invalidateQueries({ queryKey: keys.adminUsers });

  const run = async (event: string, action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      log.info(event, "admin action done", { user: user?.id });
      toast(done);
      await refresh();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: { role?: Role; enabled?: boolean }, event: string) =>
    run(event, () => api.patch(`/admin/users/${user!.id}`, body), t("settings.saved"));

  const resetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = String(new FormData(form).get("password"));
    if (await run("ADMIN_PASSWORD_RESET", () => api.post(`/admin/users/${user!.id}/password`, { password }), t("users.passwordReset"))) {
      form.reset();
    }
  };

  return (
    <>
      <Sheet open={user !== null} onClose={onClose} title={user?.displayName ?? ""} closeLabel={t("common.close")}>
        {user && (
          <div className="space-y-6 pb-2">
            <p className="-mt-2 text-sm text-ink-soft">{user.email}</p>

            <div>
              <p className="mb-2 text-sm font-semibold">{t("users.role")}</p>
              <Segmented<Role>
                label={t("users.role")}
                value={user.role}
                onChange={(role) => !isSelf && patch({ role }, "ADMIN_ROLE_CHANGED")}
                options={[
                  { value: "USER", label: t("audit.role.USER") },
                  { value: "ADMIN", label: t("audit.role.ADMIN") },
                ]}
              />
              {isSelf && <p className="mt-1 text-xs text-ink-faint">{t("users.selfHint")}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {!isSelf && (
                <Button variant="secondary" loading={busy} onClick={() => patch({ enabled: !user.enabled }, user.enabled ? "ADMIN_USER_DISABLED" : "ADMIN_USER_ENABLED")}>
                  {user.enabled ? t("users.disable") : t("users.enable")}
                </Button>
              )}
              {user.locked && (
                <Button variant="secondary" loading={busy} onClick={() => run("ADMIN_USER_UNLOCKED", () => api.post(`/admin/users/${user.id}/unlock`), t("users.unlocked"))}>
                  {t("users.unlock")}
                </Button>
              )}
            </div>

            <form onSubmit={resetPassword} className="space-y-3 rounded-card border border-line p-4">
              <p className="font-semibold">{t("users.resetPassword")}</p>
              <PasswordInput name="password" label={t("users.newPassword")} autoComplete="new-password" required minLength={10} hint={t("users.resetHint")} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />
              <Button type="submit" variant="secondary" loading={busy}>
                {t("users.resetPassword")}
              </Button>
            </form>

            {error != null && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}

            {!isSelf && (
              <Button variant="danger" full onClick={() => setConfirmDelete(true)}>
                {t("users.delete")}
              </Button>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmDelete && user !== null}
        title={t("users.delete")}
        message={t("users.deleteMessage", { name: user?.displayName ?? "", places: user?.places ?? 0, equipment: user?.equipment ?? 0 })}
        confirmLabel={t("common.delete")}
        loading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (await run("ADMIN_USER_DELETED", () => api.delete(`/admin/users/${user!.id}`), t("users.deleted"))) {
            setConfirmDelete(false);
            onClose();
          } else {
            setConfirmDelete(false);
          }
        }}
      />
    </>
  );
}

function CreateUserSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("USER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.post("/admin/users", {
        email: data.get("email"),
        displayName: data.get("displayName"),
        password: data.get("password"),
        role,
      });
      log.info("ADMIN_USER_CREATED", "user created by admin", { role });
      toast(t("users.created"));
      await qc.invalidateQueries({ queryKey: keys.adminUsers });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("users.create")} closeLabel={t("common.close")}>
      <form onSubmit={submit} className="space-y-4 pb-2">
        <TextInput name="displayName" label={t("auth.displayName")} required maxLength={80} />
        <TextInput name="email" type="email" label={t("auth.email")} required autoCapitalize="none" />
        <PasswordInput name="password" label={t("auth.password")} autoComplete="new-password" required minLength={10} hint={t("users.resetHint")} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />
        <div>
          <p className="mb-2 text-sm font-semibold">{t("users.role")}</p>
          <Segmented<Role>
            label={t("users.role")}
            value={role}
            onChange={setRole}
            options={[
              { value: "USER", label: t("audit.role.USER") },
              { value: "ADMIN", label: t("audit.role.ADMIN") },
            ]}
          />
        </div>
        {error != null && <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>}
        <Button type="submit" full size="lg" loading={busy}>
          {t("common.create")}
        </Button>
      </form>
    </Sheet>
  );
}

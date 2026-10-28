"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AdminPlace, AdminUser, Invitation, AuditEntry, Equipment, EquipmentInput, Folder, Page, Place, PlaceInput, ShareLink, User } from "./types";

/** React Query cache keys. */
export const keys = {
  me: ["me"] as const,
  folders: ["folders"] as const,
  equipment: ["equipment"] as const,
  place: (id: string) => ["place", id] as const,
  adminUsers: ["admin", "users"] as const,
  adminSettings: ["admin", "settings"] as const,
  invitations: ["admin", "invitations"] as const,
  adminPlaces: ["admin", "places"] as const,
  shares: (placeId: string) => ["shares", placeId] as const,
};

/** The signed-in user. */
export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<User>("/auth/me"),
    staleTime: 5 * 60_000,
    retry: false,
  });

/** Folders with their places. */
export const useFolders = () => useQuery({ queryKey: keys.folders, queryFn: () => api.get<Folder[]>("/folders") });

/** All equipment of the user. */
export const useEquipment = () =>
  useQuery({ queryKey: keys.equipment, queryFn: () => api.get<Equipment[]>("/equipment") });

/** One place with its markers. */
export const usePlace = (id: string) =>
  useQuery({ queryKey: keys.place(id), queryFn: () => api.get<Place>(`/places/${id}`) });

/** Create / rename / delete folders. */
export function useFolderMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.folders });
  return {
    create: useMutation({ mutationFn: (name: string) => api.post<Folder>("/folders", { name }), onSuccess: refresh }),
    rename: useMutation({
      mutationFn: (v: { id: string; name: string }) => api.patch<Folder>(`/folders/${v.id}`, { name: v.name }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/folders/${id}`),
      onSuccess: refresh,
    }),
  };
}

/** Create / update / delete equipment. */
export function useEquipmentMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.equipment });
  return {
    create: useMutation({
      mutationFn: (input: EquipmentInput) => api.post<Equipment>("/equipment", input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: EquipmentInput }) => api.put<Equipment>(`/equipment/${v.id}`, v.input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/equipment/${id}`), onSuccess: refresh }),
  };
}

/** Create / update / delete places. */
export function usePlaceMutations() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: keys.folders });
    if (id) qc.invalidateQueries({ queryKey: keys.place(id) });
  };
  return {
    create: useMutation({
      mutationFn: (input: PlaceInput) => api.post<Place>("/places", input),
      onSuccess: (p) => refresh(p.id),
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: PlaceInput }) => api.put<Place>(`/places/${v.id}`, v.input),
      onSuccess: (p) => refresh(p.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/places/${id}`),
      onSuccess: () => refresh(),
    }),
  };
}

/** All accounts (admin). */
export const useAdminUsers = () => useQuery({ queryKey: keys.adminUsers, queryFn: () => api.get<AdminUser[]>("/admin/users") });

/** Latest invitations (admin). */
export const useInvitations = () => useQuery({ queryKey: keys.invitations, queryFn: () => api.get<Invitation[]>("/admin/invitations") });

/** All places of all users (admin). */
export const useAdminPlaces = () => useQuery({ queryKey: keys.adminPlaces, queryFn: () => api.get<AdminPlace[]>("/admin/places") });

/** Whether public registration is open (admin). */
export const useRegistrationSetting = () =>
  useQuery({ queryKey: keys.adminSettings, queryFn: () => api.get<{ registrationEnabled: boolean }>("/admin/settings") });

/** One page of the audit log: the global one for admins, or one place's history. */
export const useAuditPage = (scope: { placeId?: string; admin: boolean }, page: number) =>
  useQuery({
    queryKey: ["audit", scope.admin, scope.placeId ?? "all", page],
    queryFn: () => {
      const q = `?page=${page}&size=25`;
      return scope.admin && !scope.placeId
        ? api.get<Page<AuditEntry>>(`/admin/audit${q}`)
        : scope.admin
          ? api.get<Page<AuditEntry>>(`/admin/audit${q}&placeId=${scope.placeId}`)
          : api.get<Page<AuditEntry>>(`/places/${scope.placeId}/activity${q}`);
    },
    placeholderData: (prev) => prev,
  });

/** Share links of a place. */
export const useShares = (placeId: string, enabled: boolean) =>
  useQuery({ queryKey: keys.shares(placeId), queryFn: () => api.get<ShareLink[]>(`/places/${placeId}/shares`), enabled });

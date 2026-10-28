/** Kind of equipment. */
export type EquipmentCategory = "STAND" | "OTHER";

/** Image position of a stand (or `PHOTO` for other equipment). */
export type EquipmentSlot =
  | "TOP_BAR_ADD_1"
  | "TOP_BAR_ADD_2"
  | "TOP_BAR"
  | "FOOT"
  | "LIGHT_1"
  | "LIGHT_2"
  | "LIGHT_3"
  | "LIGHT_4"
  | "LIGHT_5"
  | "PHOTO";

/** Slot to image id. */
export type EquipmentImages = Partial<Record<EquipmentSlot, string>>;

/** Authorisation role. */
export type Role = "USER" | "ADMIN";

/** The signed-in user. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

/** A user as seen by admins. */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  locked: boolean;
  createdAt: string;
  places: number;
  equipment: number;
}

/** An invitation to create an account. */
export interface Invitation {
  id: string;
  /** Only present in the response to creating the invitation; the server keeps just a hash. */
  token?: string | null;
  email: string | null;
  role: Role;
  status: "PENDING" | "USED" | "REVOKED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
}

/** One line of an audit entry (`code` is translated in the UI). */
export interface Change {
  code: string;
  ref?: string | null;
  from?: string | null;
  to?: string | null;
}

/** One entry of the audit log. */
export interface AuditEntry {
  id: string;
  at: string;
  actorName: string;
  actorType: "USER" | "GUEST" | "SYSTEM";
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  placeId?: string | null;
  placeName?: string | null;
  changes: Change[];
  ip?: string | null;
}

/** A page of a paginated list. */
export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

/** A share link of a place. */
export interface ShareLink {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  active: boolean;
}

/** A place with its owner (admin filter). */
export interface AdminPlace {
  id: string;
  name: string;
  folderName: string | null;
  ownerName: string | null;
}

/** One server log line. */
export interface LogEntry {
  seq: number;
  ts: string;
  level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
  logger: string;
  thread: string;
  message: string;
  requestId: string | null;
  user: string | null;
  stack: string | null;
}

/** A piece of equipment. */
export interface Equipment {
  id: string;
  title: string;
  description: string;
  category: EquipmentCategory;
  images: EquipmentImages;
}

/** Payload to create / update equipment. */
export interface EquipmentInput {
  title: string;
  description: string;
  category: EquipmentCategory;
  images: EquipmentImages;
}

/** A place as listed in a folder. */
export interface PlaceSummary {
  id: string;
  name: string;
  folderId: string;
  floorPlanImageId: string | null;
}

/** A folder with its places. */
export interface Folder {
  id: string;
  name: string;
  places: PlaceSummary[];
}

/** A marker on a floor plan (x / y are 0..1 of the image). */
export interface Placement {
  /** Client-side key only; the server assigns real ids on save. */
  id: string;
  x: number;
  y: number;
  equipmentId: string | null;
  color: string;
}

/** A place with its markers. */
export interface Place {
  id: string;
  name: string;
  folderId: string;
  floorPlanImageId: string;
  placements: Placement[];
}

/** Payload to create / update a place. */
export interface PlaceInput {
  name: string;
  folderId: string;
  floorPlanImageId: string;
  /** `id` is only sent for markers that already exist on the server, so their history stays attached. */
  placements: (Omit<Placement, "id"> & { id?: string })[];
}

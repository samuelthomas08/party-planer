import { describe, expect, it } from "vitest";
import de from "./messages/de.json";
import en from "./messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});
}

const german = flatten(de as Tree);
const english = flatten(en as Tree);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("define exactly the same keys in German and English", () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(german).sort());
  });

  it("have no empty texts", () => {
    for (const [key, text] of [...Object.entries(german), ...Object.entries(english)]) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("use the same placeholders in both languages, so no variable is silently dropped", () => {
    for (const key of Object.keys(german)) {
      expect(placeholders(english[key]), key).toEqual(placeholders(german[key]));
    }
  });

  it("cover every error code the backend can send", () => {
    const codes = [
      "INVALID_CREDENTIALS", "EMAIL_TAKEN", "REGISTRATION_DISABLED", "RATE_LIMITED", "VALIDATION_FAILED", "PASSWORD_WEAK",
      "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "IMAGE_TOO_LARGE", "IMAGE_UNSUPPORTED", "IMAGE_UNREADABLE", "IMAGE_EMPTY",
      "IMAGE_INVALID", "EQUIPMENT_INVALID", "SLOT_INVALID", "PHOTO_REQUIRED", "BAD_REQUEST", "HTTP_ERROR", "INTERNAL_ERROR",
      "NETWORK", "SHARE_INVALID", "WRONG_PASSWORD", "CANNOT_MODIFY_SELF", "LAST_ADMIN", "INVITE_INVALID",
    ];
    for (const code of codes) expect(german[`errors.${code}`], code).toBeDefined();
  });

  it("describe every audit action and change code the backend writes", () => {
    const actions = [
      "USER_REGISTERED", "LOGIN", "LOGIN_FAILED", "LOGOUT", "PROFILE_UPDATED", "PASSWORD_CHANGED", "USER_CREATED", "USER_UPDATED",
      "USER_PASSWORD_RESET", "USER_UNLOCKED", "USER_DELETED", "FOLDER_CREATED", "FOLDER_RENAMED", "FOLDER_DELETED", "PLACE_CREATED",
      "PLACE_UPDATED", "PLACE_DELETED", "EQUIPMENT_CREATED", "EQUIPMENT_UPDATED", "EQUIPMENT_DELETED", "SHARE_CREATED", "SHARE_REVOKED",
      "GUEST_JOINED", "SETTINGS_CHANGED", "LOG_LEVEL_CHANGED", "INVITATION_CREATED", "INVITATION_REVOKED", "INVITATION_ACCEPTED",
    ];
    const changes = [
      "NAME", "FOLDER", "FLOOR_PLAN_REPLACED", "MARKERS_COUNT", "MARKER_ADDED", "MARKER_REMOVED", "MARKER_EQUIPMENT", "MARKER_COLOR",
      "MARKER_MOVED", "TITLE", "DESCRIPTION", "CATEGORY", "IMAGE_ADDED", "IMAGE_REMOVED", "IMAGE_REPLACED", "ROLE", "ENABLED", "DISABLED",
      "ACCOUNT_DISABLED", "ACCOUNT_LOCKED", "FIRST_ADMIN", "PLACES_COUNT", "EXPIRES", "NO_EXPIRY", "REGISTRATION", "FOLDER_DELETED", "LOG_LEVEL",
    ];
    for (const a of actions) expect(german[`audit.action.${a}`], a).toBeDefined();
    for (const c of changes) expect(german[`audit.change.${c}`], c).toBeDefined();
  });

  it("name all ten equipment slots", () => {
    for (const slot of ["TOP_BAR_ADD_1", "TOP_BAR_ADD_2", "TOP_BAR", "FOOT", "LIGHT_1", "LIGHT_2", "LIGHT_3", "LIGHT_4", "LIGHT_5", "PHOTO"]) {
      expect(german[`equipment.slots.${slot}`], slot).toBeDefined();
    }
  });
});

import { ApiError } from "./api";

/** Translation key (under "errors.") for any thrown value. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  return "NETWORK";
}

import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { errorKey } from "./errors";

describe("errorKey", () => {
  it("uses the stable code of an API error", () => {
    expect(errorKey(new ApiError(409, "EMAIL_TAKEN"))).toBe("EMAIL_TAKEN");
  });

  it("treats anything else as a connectivity problem", () => {
    expect(errorKey(new Error("boom"))).toBe("NETWORK");
    expect(errorKey(undefined)).toBe("NETWORK");
    expect(errorKey("oops")).toBe("NETWORK");
  });
});

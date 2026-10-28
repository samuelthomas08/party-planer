import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { useMediaQuery } from "@/lib/hooks";
import { renderApp } from "@/test/utils";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/images")>();
  return { ...actual, uploadImage: upload };
});
vi.mock("@/lib/logger", () => ({ log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, installGlobalLogging: vi.fn() }));

import { UnsupportedImageError } from "@/lib/images";
import { Logo } from "./layout/Logo";
import { PageHeader } from "./layout/PageHeader";
import { ImageUploadButton } from "./ui/ImageUploadButton";

describe("i18n config", () => {
  it("supports German and English with German as default", () => {
    expect(LOCALES).toEqual(["de", "en"]);
    expect(DEFAULT_LOCALE).toBe("de");
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });

  it("recognises only supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("useMediaQuery", () => {
  it("follows the browser's media query", () => {
    let listener: () => void = () => {};
    let matches = false;
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_: string, cb: () => void) => (listener = cb),
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);

    matches = true;
    act(() => listener());
    expect(result.current).toBe(true);
  });
});

describe("layout pieces", () => {
  it("Logo shows the product name", () => {
    render(<Logo />);
    expect(screen.getByText("Party Planer")).toBeInTheDocument();
  });

  it("PageHeader shows the title, a labelled back link and actions", () => {
    render(<PageHeader title="Edit" backHref="/places/1" backLabel="Back" actions={<button>Act</button>} />);

    expect(screen.getByRole("heading", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/places/1");
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("PageHeader goes back to the dashboard by default", () => {
    render(<PageHeader title="Edit" backLabel="Back" />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
  });
});

describe("ImageUploadButton", () => {
  const file = (type = "image/png") => new File(["x"], "a.png", { type });
  const pick = (f: File) => fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [f] } });

  it("accepts the same types as the server", () => {
    renderApp(<ImageUploadButton maxSizeMB={1} maxDimension={800} onUploaded={() => {}}>Choose</ImageUploadButton>);
    expect(document.querySelector('input[type="file"]')).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
  });

  it("uploads the picked file with the requested limits and reports the new id", async () => {
    upload.mockResolvedValue("new-id");
    const onUploaded = vi.fn();
    renderApp(<ImageUploadButton maxSizeMB={0.15} maxDimension={800} onUploaded={onUploaded}>Choose</ImageUploadButton>);

    pick(file());

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("new-id"));
    expect(upload).toHaveBeenCalledWith(expect.any(File), { maxSizeMB: 0.15, maxDimension: 800 });
  });

  it("tells the user about unsupported files and does not report an id", async () => {
    upload.mockRejectedValue(new UnsupportedImageError());
    const onUploaded = vi.fn();
    renderApp(<ImageUploadButton maxSizeMB={1} maxDimension={800} onUploaded={onUploaded}>Choose</ImageUploadButton>);

    pick(file("image/svg+xml"));

    expect(await screen.findByRole("alert")).toHaveTextContent("nicht unterstützt");
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("explains server-side failures with the translated reason", async () => {
    const { ApiError } = await import("@/lib/api");
    upload.mockRejectedValue(new ApiError(413, "IMAGE_TOO_LARGE"));
    renderApp(<ImageUploadButton maxSizeMB={1} maxDimension={800} onUploaded={() => {}}>Choose</ImageUploadButton>);

    pick(file());

    expect(await screen.findByRole("alert")).toHaveTextContent("Das Bild ist zu groß.");
  });

  it("ignores an empty selection", async () => {
    upload.mockClear();
    renderApp(<ImageUploadButton maxSizeMB={1} maxDimension={800} onUploaded={() => {}}>Choose</ImageUploadButton>);

    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [] } });
    await userEvent.tab();

    expect(upload).not.toHaveBeenCalled();
  });
});

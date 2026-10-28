import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/lib/types";
import { renderApp } from "@/test/utils";
import { ActivityList } from "./ActivityList";
import { AuditPager } from "./AuditPager";

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: crypto.randomUUID(), at: "2026-10-28T09:30:00Z", actorName: "Ada Lovelace", actorType: "USER", action: "PLACE_UPDATED",
  entityType: "PLACE", entityName: "Main hall", placeId: "p1", placeName: "Main hall", changes: [], ip: "10.0.0.7", ...over,
});

describe("ActivityList", () => {
  it("shows an empty message without entries", () => {
    renderApp(<ActivityList entries={[]} />);
    expect(screen.getByText("Noch keine Einträge.")).toBeInTheDocument();
  });

  it("answers who, what, when and where", () => {
    renderApp(<ActivityList entries={[entry()]} />);
    expect(screen.getByText("Ort „Main hall“ geändert")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-10-28T09:30:00Z");
    expect(screen.getByText(/Ort:/)).toBeInTheDocument();
  });

  it("answers how, with a readable line per change", () => {
    renderApp(
      <ActivityList
        entries={[entry({
          changes: [
            { code: "NAME", from: "Main", to: "Main hall" },
            { code: "FOLDER", from: "Hall", to: "Garden" },
            { code: "MARKER_MOVED", ref: "2" },
            { code: "MARKER_ADDED", ref: "3", to: "Spot" },
            { code: "MARKER_EQUIPMENT", ref: "1", from: "Truss", to: null },
            { code: "FLOOR_PLAN_REPLACED" },
            { code: "IMAGE_ADDED", ref: "FOOT" },
            { code: "CATEGORY", from: "STAND", to: "OTHER" },
          ],
        })]}
      />,
    );
    expect(screen.getByText("Name: „Main“ → „Main hall“")).toBeInTheDocument();
    expect(screen.getByText("Ordner: Hall → Garden")).toBeInTheDocument();
    expect(screen.getByText("Markierung 2 verschoben")).toBeInTheDocument();
    expect(screen.getByText("Markierung 3 hinzugefügt (Equipment: Spot)")).toBeInTheDocument();
    expect(screen.getByText("Markierung 1: Equipment Truss → –")).toBeInTheDocument();
    expect(screen.getByText("Grundriss ersetzt")).toBeInTheDocument();
    expect(screen.getByText("Bild „Fuß“ hinzugefügt")).toBeInTheDocument();
    expect(screen.getByText("Typ: Ständer → Anderes")).toBeInTheDocument();
  });

  it("shows both colours of a colour change", () => {
    renderApp(<ActivityList entries={[entry({ changes: [{ code: "MARKER_COLOR", ref: "1", from: "#112233", to: "#445566" }] })]} />);
    expect(screen.getByText("#112233")).toBeInTheDocument();
    expect(screen.getByText("#445566")).toBeInTheDocument();
    expect(screen.getByText(/Markierung 1: Farbe/)).toBeInTheDocument();
  });

  it("translates roles, expiry and switches", () => {
    renderApp(
      <ActivityList entries={[entry({
        action: "USER_UPDATED", entityType: "USER", placeId: null,
        changes: [{ code: "ROLE", from: "USER", to: "ADMIN" }, { code: "REGISTRATION", from: "true", to: "false" }, { code: "NO_EXPIRY" }],
      })]} />,
    );
    expect(screen.getByText("Rolle: Nutzer → Admin")).toBeInTheDocument();
    expect(screen.getByText("Registrierung: aus")).toBeInTheDocument();
    expect(screen.getByText("Unbegrenzt gültig")).toBeInTheDocument();
  });

  it("flags guests and the system", () => {
    renderApp(<ActivityList entries={[entry({ actorType: "GUEST", actorName: "Gina" }), entry({ actorType: "SYSTEM", actorName: "System" })]} />);
    expect(screen.getByText("Gast")).toBeInTheDocument();
    expect(screen.getAllByText("System").length).toBeGreaterThanOrEqual(2);
  });

  it("shows IP addresses only when asked to", () => {
    const { unmount } = renderApp(<ActivityList entries={[entry()]} />);
    expect(screen.queryByText(/IP 10\.0\.0\.7/)).not.toBeInTheDocument();
    unmount();
    renderApp(<ActivityList entries={[entry()]} showIp />);
    expect(screen.getByText("IP 10.0.0.7")).toBeInTheDocument();
  });

  it("makes the place clickable only when a handler is given", async () => {
    const onPlaceClick = vi.fn();
    const { unmount } = renderApp(<ActivityList entries={[entry()]} />);
    expect(screen.queryByRole("button", { name: "Main hall" })).not.toBeInTheDocument();
    unmount();

    renderApp(<ActivityList entries={[entry()]} onPlaceClick={onPlaceClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Main hall" }));
    expect(onPlaceClick).toHaveBeenCalledWith("p1");
  });

  it("does not crash on codes it has never seen", () => {
    renderApp(<ActivityList entries={[entry({ action: "BRAND_NEW_ACTION", changes: [{ code: "BRAND_NEW_CHANGE" }] })]} />);
    expect(screen.getByText("BRAND_NEW_ACTION")).toBeInTheDocument();
    expect(screen.getByText("BRAND_NEW_CHANGE")).toBeInTheDocument();
  });

  it("speaks English too", () => {
    renderApp(<ActivityList entries={[entry({ changes: [{ code: "MARKER_MOVED", ref: "2" }] })]} />, { locale: "en" });
    expect(screen.getByText("Venue “Main hall” changed")).toBeInTheDocument();
    expect(screen.getByText("Marker 2 moved")).toBeInTheDocument();
  });
});

describe("AuditPager", () => {
  it("is hidden when everything fits on one page", () => {
    renderApp(<AuditPager page={0} totalPages={1} onPage={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables 'newer' on the first page and pages forward", async () => {
    const onPage = vi.fn();
    renderApp(<AuditPager page={0} totalPages={3} onPage={onPage} />);
    expect(screen.getByRole("button", { name: /Neuer/ })).toBeDisabled();
    expect(screen.getByText("Seite 1 von 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Älter/ }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("disables 'older' on the last page and pages back", async () => {
    const onPage = vi.fn();
    renderApp(<AuditPager page={2} totalPages={3} onPage={onPage} />);
    expect(screen.getByRole("button", { name: /Älter/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Neuer/ }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});

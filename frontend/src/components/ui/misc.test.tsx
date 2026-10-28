import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge, Card, EmptyState, ErrorNote, Segmented, Spinner } from "./misc";

describe("Segmented", () => {
  const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];

  it("exposes tab semantics and marks the selected option", () => {
    render(<Segmented label="Kind" value="a" options={options} onChange={() => {}} />);
    expect(screen.getByRole("tablist", { name: "Kind" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "false");
  });

  it("reports the clicked option", async () => {
    const onChange = vi.fn();
    render(<Segmented label="Kind" value="a" options={options} onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does not submit forms it lives in", () => {
    render(<Segmented label="Kind" value="a" options={options} onChange={() => {}} />);
    for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveAttribute("type", "button");
  });
});

describe("small building blocks", () => {
  it("Spinner announces its label", () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("ErrorNote is an alert", () => {
    render(<ErrorNote>Something broke</ErrorNote>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it("EmptyState shows title and explanation", () => {
    render(<EmptyState icon={<svg />} title="Nothing here">Add something</EmptyState>);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add something")).toBeInTheDocument();
  });

  it("Badge and Card render their children", () => {
    render(<Card><Badge tone="party">Guest</Badge></Card>);
    expect(screen.getByText("Guest")).toBeInTheDocument();
  });
});

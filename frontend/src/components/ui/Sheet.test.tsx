import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

function renderSheet(props: Partial<React.ComponentProps<typeof Sheet>> = {}) {
  const onClose = vi.fn();
  const result = render(
    <Sheet open onClose={onClose} title="Edit user" closeLabel="Close" footer={<button>Save</button>} {...props}>
      <p>Body text</p>
    </Sheet>,
  );
  return { onClose, ...result };
}

describe("Sheet", () => {
  it("opens the native dialog and shows title, body and footer", () => {
    const { container } = renderSheet();
    expect(container.querySelector("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Edit user" })).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("is labelled by its title", () => {
    const { container } = renderSheet();
    const dialog = container.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading").id);
  });

  it("renders nothing inside while closed, so its state resets on every open", () => {
    renderSheet({ open: false });
    expect(screen.queryByText("Body text")).not.toBeInTheDocument();
  });

  it("closes through the close button", async () => {
    const { onClose } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked but not when the panel is", () => {
    const { onClose, container } = renderSheet();
    const backdrop = container.querySelector("dialog")!.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByText("Body text"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports the native close event (Escape key)", () => {
    const { onClose, container } = renderSheet();
    fireEvent(container.querySelector("dialog")!, new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes the dialog when open turns false", () => {
    const { rerender, container } = renderSheet();
    rerender(<Sheet open={false} onClose={() => {}} title="Edit user" closeLabel="Close">x</Sheet>);
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");
  });
});

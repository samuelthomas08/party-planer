import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/utils";
import { ConfirmDialog } from "./ConfirmDialog";

function setup(extra: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderApp(
    <ConfirmDialog open title="Delete place" message="Really delete “Hall”?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} {...extra} />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("asks with the given texts", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Delete place" })).toBeInTheDocument();
    expect(screen.getByText("Really delete “Hall”?")).toBeInTheDocument();
  });

  it("confirms", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels with the translated cancel button", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks a second confirmation while the action runs", () => {
    setup({ loading: true });
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

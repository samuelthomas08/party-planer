import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ kind }: { kind?: "success" | "error" }) {
  const toast = useToast();
  return <button onClick={() => toast("Saved!", kind)}>go</button>;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("shows a success message politely", async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText("go"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved!");
  });

  it("announces errors as alerts", async () => {
    render(<ToastProvider><Trigger kind="error" /></ToastProvider>);
    await userEvent.click(screen.getByText("go"));
    expect(screen.getByRole("alert")).toHaveTextContent("Saved!");
  });

  it("disappears by itself", async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText("go"));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps at most three messages on screen", async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByText("go"));
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("is harmless outside a provider", async () => {
    render(<Trigger />);
    await userEvent.click(screen.getByText("go"));
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "./Button";

describe("Button", () => {
  it("is a plain button by default so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("can be a submit button", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Wait</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled when told so", () => {
    render(<Button disabled>No</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders its icon", () => {
    render(<Button icon={<svg data-testid="icon" />}>With icon</Button>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});

describe("IconButton", () => {
  it("is named for assistive technology and shows the label as tooltip", () => {
    render(<IconButton label="Delete"><svg /></IconButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("title", "Delete");
  });

  it("reacts to clicks", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Close" onClick={onClick}><svg /></IconButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

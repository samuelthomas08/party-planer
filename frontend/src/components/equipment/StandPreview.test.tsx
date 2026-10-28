import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setImageBase } from "@/lib/api";
import { StandPreview } from "./StandPreview";

beforeEach(() => setImageBase("/api/images"));

describe("StandPreview (display)", () => {
  it("draws only the parts that have an image", () => {
    const { container } = render(<StandPreview images={{ FOOT: "foot-id", TOP_BAR: "bar-id" }} />);
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs.sort()).toEqual(["/api/images/bar-id", "/api/images/foot-id"]);
  });

  it("shows no buttons when it is not editable", () => {
    render(<StandPreview images={{}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("uses the guest image endpoint after the base was switched", () => {
    setImageBase("/api/guest/images");
    const { container } = render(<StandPreview images={{ FOOT: "f" }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/api/guest/images/f");
  });

  it("keeps the drawing's aspect ratio", () => {
    const { container } = render(<StandPreview images={{}} />);
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: "510 / 573" });
  });
});

describe("StandPreview (editing)", () => {
  it("offers all nine slots as buttons, filled or empty", () => {
    render(<StandPreview images={{ FOOT: "f" }} onSlotClick={() => {}} slotLabel={(s) => `slot ${s}`} />);
    expect(screen.getAllByRole("button")).toHaveLength(9);
    expect(screen.getByRole("button", { name: "slot FOOT" }).querySelector("img")).toBeTruthy();
    expect(screen.getByRole("button", { name: "slot LIGHT_3" }).querySelector("img")).toBeNull();
  });

  it("reports which slot was tapped", async () => {
    const onSlotClick = vi.fn();
    render(<StandPreview images={{}} onSlotClick={onSlotClick} slotLabel={(s) => s} />);
    await userEvent.click(screen.getByRole("button", { name: "LIGHT_2" }));
    expect(onSlotClick).toHaveBeenCalledWith("LIGHT_2");
  });

  it("positions slots in percent so it scales to any screen", () => {
    render(<StandPreview images={{}} onSlotClick={() => {}} slotLabel={(s) => s} />);
    const foot = screen.getByRole("button", { name: "FOOT" });
    expect(foot.style.left).toMatch(/%$/);
    expect(foot.style.width).toMatch(/%$/);
  });
});

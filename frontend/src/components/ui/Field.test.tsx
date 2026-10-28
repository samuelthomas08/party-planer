import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput, Select, TextArea, TextInput } from "./Field";

describe("TextInput", () => {
  it("connects label and input", () => {
    render(<TextInput label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("shows a hint and links it to the input", () => {
    render(<TextInput label="Name" hint="At least 3 letters" />);
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("At least 3 letters");
  });

  it("announces errors, marks the field invalid and prefers the error over the hint", () => {
    render(<TextInput label="Name" hint="a hint" error="Required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.queryByText("a hint")).not.toBeInTheDocument();
    expect(input).toHaveAccessibleDescription("Required");
  });

  it("is valid when there is no error", () => {
    render(<TextInput label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "false");
  });

  it("passes native attributes through", () => {
    render(<TextInput label="Email" type="email" required maxLength={20} autoComplete="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("maxlength", "20");
  });

  it("gives every field its own id", () => {
    render(<><TextInput label="A" /><TextInput label="B" /></>);
    expect(screen.getByLabelText("A").id).not.toBe(screen.getByLabelText("B").id);
  });
});

describe("PasswordInput", () => {
  it("hides the password until asked and toggles back", async () => {
    render(<PasswordInput label="Password" showLabel="Show" hideLabel="Hide" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("never submits the form with the toggle", () => {
    render(<PasswordInput label="Password" showLabel="Show" hideLabel="Hide" />);
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("type", "button");
  });
});

describe("TextArea and Select", () => {
  it("label their controls", () => {
    render(<><TextArea label="Description" /><Select label="Folder"><option>Hall</option></Select></>);
    expect(screen.getByLabelText("Description").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Folder").tagName).toBe("SELECT");
  });

  it("lets the user choose an option", async () => {
    render(<Select label="Folder"><option value="a">Hall</option><option value="b">Garden</option></Select>);
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "b");
    expect(screen.getByLabelText("Folder")).toHaveValue("b");
  });
});

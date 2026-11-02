import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { ToolDialog } from "./tool-dialog";

vi.mock("next/navigation", () => ({ usePathname: () => "/listings" }));

afterEach(cleanup);

async function setup(
  onSubmit = vi.fn((): Promise<unknown> => Promise.resolve()),
) {
  const user = userEvent.setup();
  render(
    <ToolDialog
      trigger={<Button>List a tool</Button>}
      title="Add one"
      description="Details."
      submitLabel="List tool"
      doneMessage={(name) => `${name} is listed.`}
      onSubmit={onSubmit}
    />,
  );
  await user.click(screen.getByRole("button", { name: "List a tool" }));
  return { onSubmit, user };
}

const dialog = () => screen.queryByRole("dialog", { name: "Add one" });
const name = () => screen.getByLabelText("Name") as HTMLInputElement;

test("opens with focus on the first field", async () => {
  await setup();
  expect(document.activeElement).toBe(name());
});

test("Escape closes an untouched form", async () => {
  const { user } = await setup();
  await user.keyboard("{Escape}");
  expect(dialog()).toBeNull();
});

test("Escape on typed text asks first, and Keep editing keeps the text", async () => {
  const { user } = await setup();
  await user.type(name(), "Half typed");
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("alertdialog", { name: "Discard your changes?" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(name().value).toBe("Half typed");
});

test("Cancel on typed text also asks, and Discard closes and forgets it", async () => {
  const { user } = await setup();
  await user.type(name(), "Half typed");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard" }));
  expect(dialog()).toBeNull();
  await user.click(screen.getByRole("button", { name: "List a tool" }));
  expect(name().value).toBe("");
});

test("a blank name shows the shared schema's message and sends nothing", async () => {
  const { onSubmit, user } = await setup();
  await user.type(name(), "   ");
  await user.click(screen.getByRole("button", { name: "List tool" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Enter a name for the tool.",
  );
  expect(name().getAttribute("aria-invalid")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a saved form sends trimmed fields and closes", async () => {
  const { onSubmit, user } = await setup();
  await user.type(name(), "  Ladder ");
  await user.selectOptions(screen.getByLabelText("Category"), "garden");
  await user.click(screen.getByRole("button", { name: "List tool" }));
  await waitFor(() => expect(dialog()).toBeNull());
  expect(onSubmit).toHaveBeenCalledWith({
    name: "Ladder",
    category: "garden",
    condition: "good",
    description: "",
  });
});

test("the description counter follows what is typed", async () => {
  const { user } = await setup();
  await user.type(screen.getByLabelText("Short description"), "abc");
  expect(screen.getByText("497 of 500 characters left.")).toBeTruthy();
});

test("a failed save stays open and shows the error", async () => {
  const { user } = await setup(vi.fn(() => Promise.reject(new Error("boom"))));
  await user.type(name(), "Ladder");
  await user.click(screen.getByRole("button", { name: "List tool" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(dialog()).not.toBeNull();
});

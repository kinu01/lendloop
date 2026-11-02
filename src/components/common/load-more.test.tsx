import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { LoadMore } from "./load-more";

test("loads another page when pressed", async () => {
  const loadMore = vi.fn();
  render(<LoadMore status="CanLoadMore" loadMore={loadMore} label="tools" />);
  await userEvent.click(
    screen.getByRole("button", { name: "Load more tools" }),
  );
  expect(loadMore).toHaveBeenCalledWith(24);
});

test("is disabled while a page loads", () => {
  render(<LoadMore status="LoadingMore" loadMore={vi.fn()} label="tools" />);
  expect(screen.getByRole("button")).toBeDisabled();
});

test("shows nothing once every row has loaded", () => {
  const { container } = render(
    <LoadMore status="Exhausted" loadMore={vi.fn()} label="tools" />,
  );
  expect(container).toBeEmptyDOMElement();
});

test("moves focus to main when the pressed button disappears", async () => {
  const props = { loadMore: vi.fn(), label: "tools" };
  const { rerender } = render(
    <main id="main" tabIndex={-1}>
      <LoadMore status="CanLoadMore" {...props} />
    </main>,
  );
  await userEvent.click(screen.getByRole("button"));
  rerender(
    <main id="main" tabIndex={-1}>
      <LoadMore status="Exhausted" {...props} />
    </main>,
  );
  expect(screen.getByRole("main")).toHaveFocus();
});

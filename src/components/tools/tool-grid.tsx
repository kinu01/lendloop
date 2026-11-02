import type { ComponentProps } from "react";

export function ToolGrid(props: ComponentProps<"ul">) {
  return (
    <ul
      className="my-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
      {...props}
    />
  );
}

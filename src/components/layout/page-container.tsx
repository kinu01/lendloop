import type { ComponentProps } from "react";

export function PageContainer(props: ComponentProps<"main">) {
  return (
    <main
      id="main"
      className="mx-auto max-w-240 px-4 pb-12 outline-none"
      {...props}
    />
  );
}

"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ToolDialog } from "@/components/tools/tool-dialog";
import { Button } from "@/components/ui/button";

export function AddToolButton() {
  const create = useMutation(api.tools.create);
  return (
    <ToolDialog
      trigger={<Button>List a tool</Button>}
      title="List a tool"
      description="Neighbors see these details when they browse."
      submitLabel="List tool"
      doneMessage={(name) => `${name} is listed.`}
      onSubmit={(fields) => create(fields)}
    />
  );
}

"use client";

import { useActionState } from "react";
import { ActionToast } from "@/components/toaster";
import { Button } from "@/components/ui";
import { t } from "@/lib/strings";
import { archiveItemAction, type ItemFormState } from "./actions";

/** Archive or restore one item. Archiving asks for confirmation; nothing is ever deleted. */
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [state, action, pending] = useActionState<ItemFormState, FormData>(
    archiveItemAction,
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!archived && !window.confirm(t.items.detail.archiveConfirm)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={archived ? "restore" : "archive"} />
      <Button type="submit" variant={archived ? "secondary" : "danger"} disabled={pending}>
        {archived ? t.items.detail.restore : t.items.detail.archive}
      </Button>
      <div aria-live="polite">
        <ActionToast state={state} />
      </div>
    </form>
  );
}

"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
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
      <Button type="submit" variant={archived ? "outline" : "destructive"} disabled={pending}>
        {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        {archived ? t.items.detail.restore : t.items.detail.archive}
      </Button>
      <div aria-live="polite">
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.ok && <Notice tone="success">{state.ok}</Notice>}
      </div>
    </form>
  );
}

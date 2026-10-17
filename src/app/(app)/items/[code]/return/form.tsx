"use client";

import { useActionState } from "react";
import { ActionToast } from "@/components/toaster";
import { Button } from "@/components/ui";
import { t } from "@/lib/strings";
import { type ContentRow, ContentsEditor } from "../../contents-editor";
import { type FlowFormState, returnItemAction } from "../flow-actions";
import { FlowFields, rememberActorName } from "../flow-fields";

export function ReturnForm({
  id,
  version,
  contents,
}: {
  id: string;
  version: number;
  contents: ContentRow[];
}) {
  const [state, action, pending] = useActionState<FlowFormState, FormData>(
    returnItemAction,
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={(e) => rememberActorName(e.currentTarget)}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <ActionToast state={state} />
      <ContentsEditor initial={contents} restricted />
      <div className="max-w-xl space-y-4">
        <FlowFields notePlaceholder={t.flow.notePlaceholderReturn} />
        <Button type="submit" disabled={pending}>
          {t.flow.returnSubmit}
        </Button>
      </div>
    </form>
  );
}

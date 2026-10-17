"use client";

import { useActionState } from "react";
import { ActionToast } from "@/components/toaster";
import { Button } from "@/components/ui";
import { t } from "@/lib/strings";
import { type FlowFormState, sendItemAction } from "../flow-actions";
import { FlowFields, rememberActorName } from "../flow-fields";

export function SendForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FlowFormState, FormData>(
    sendItemAction,
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={(e) => rememberActorName(e.currentTarget)}
      className="max-w-xl space-y-4"
    >
      <input type="hidden" name="id" value={id} />
      <ActionToast state={state} />
      <FlowFields />
      <Button type="submit" disabled={pending}>
        {t.flow.sendSubmit}
      </Button>
    </form>
  );
}

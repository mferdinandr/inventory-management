"use client";

import { useActionState } from "react";
import { ActionToast } from "@/components/toaster";
import { Button, Input, Label } from "@/components/ui";
import { t } from "@/lib/strings";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <ActionToast state={state} />
      <div>
        <Label htmlFor="current">{t.changePassword.current}</Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <Label htmlFor="next">{t.changePassword.next}</Label>
        <Input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t.changePassword.submit}
      </Button>
    </form>
  );
}

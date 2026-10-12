"use client";

import { useActionState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
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

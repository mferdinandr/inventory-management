"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/password-input";
import { Button, Label } from "@/components/ui";
import { t } from "@/lib/strings";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(changePassword, undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  useEffect(() => {
    if (!state) return;
    if ("ok" in state) {
      toast.success(t.changePassword.changed);
      router.push("/");
      return;
    }
    toast.error(state.error ?? t.error);
  }, [state, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next = String(form.get("next") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (next !== confirm) {
      setConfirmError(t.changePassword.notMatch);
      event.preventDefault();
    } else {
      setConfirmError(undefined);
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="current">
          {t.changePassword.current} <span className="font-semibold text-destructive">*</span>
        </Label>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          className="h-11"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">
          {t.changePassword.next} <span className="font-semibold text-destructive">*</span>
        </Label>
        <PasswordInput
          id="next"
          name="next"
          autoComplete="new-password"
          minLength={8}
          className="h-11"
          required
        />
        <p className="text-sm text-muted-foreground">{t.changePassword.hint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">
          {t.changePassword.confirm} <span className="font-semibold text-destructive">*</span>
        </Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          className="h-11"
          required
          onInput={() => setConfirmError(undefined)}
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? "confirm-error" : undefined}
        />
        {confirmError && (
          <p id="confirm-error" className="text-sm font-medium text-destructive">
            {confirmError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {t.changePassword.submit}
      </Button>
    </form>
  );
}

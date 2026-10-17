"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/password-input";
import { Button, Label } from "@/components/ui";
import { t } from "@/lib/strings";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(changePassword, undefined);

  useEffect(() => {
    if (!state) return;
    if ("ok" in state) {
      toast.success(t.changePassword.changed);
      router.push("/");
      return;
    }
    toast.error(state.error ?? t.error);
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="current">{t.changePassword.current}</Label>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          className="h-11"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">{t.changePassword.next}</Label>
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
      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {t.changePassword.submit}
      </Button>
    </form>
  );
}

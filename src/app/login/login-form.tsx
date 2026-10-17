"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Input, Label } from "@/components/ui";
import { t } from "@/lib/strings";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(login, undefined);

  useEffect(() => {
    if (state?.error) toast.error(t.login.failed);
    else if (state?.ok) {
      toast.success(t.login.success);
      router.replace(state.to ?? "/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <Label htmlFor="username">{t.login.username}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">{t.login.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {t.login.submit}
      </Button>
    </form>
  );
}

"use client";

import { Eye, EyeOff, Lock, User } from "lucide-react";
import type { FormEvent } from "react";
import { useActionState, useState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { login } from "./actions";

type FieldErrors = { username?: string; password?: string };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const name = username.trim().toLowerCase();
  if (!name) errors.username = t.login.usernameRequired;
  else if (!USERNAME_PATTERN.test(name)) errors.username = t.login.usernameInvalid;

  if (!password) errors.password = t.login.passwordRequired;
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = t.login.passwordTooShort;
  return errors;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nextErrors = validate(username, password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) event.preventDefault();
  }

  return (
    <form action={action} onSubmit={handleSubmit} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Notice tone="error">{t.login.failed}</Notice>}

      <div className="space-y-2">
        <Label htmlFor="username">{t.login.username}</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={errors.username ? "username-error" : undefined}
            className={cn("h-11 pl-10", errors.username && "border-destructive")}
          />
        </div>
        {errors.username && (
          <p id="username-error" className="text-sm font-medium text-destructive">
            {errors.username}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t.login.password}</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={cn("h-11 pr-11 pl-10", errors.password && "border-destructive")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-sm font-medium text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-800 shadow-md shadow-brand-700/25 hover:from-brand-700 hover:to-brand-900"
      >
        {pending ? t.login.submitting : t.login.submit}
      </Button>
    </form>
  );
}

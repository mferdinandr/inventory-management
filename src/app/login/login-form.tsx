"use client";

import type { FormEvent } from "react";
import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, UserIcon } from "@/components/icons";
import { Label, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
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

const inputBase =
  "w-full rounded-lg border bg-white py-3 text-base shadow-sm focus:outline-none focus:ring-2";
const inputOk = "border-ink-300 focus:border-brand-600 focus:ring-brand-600/30";
const inputError = "border-danger-400 focus:border-danger-500 focus:ring-danger-500/30";

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

      <div>
        <Label htmlFor="username">{t.login.username}</Label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-400" />
          <input
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
            className={`${inputBase} ${inputOk} ${errors.username ? inputError : ""} pl-10`}
          />
        </div>
        {errors.username && (
          <p id="username-error" className="mt-1.5 text-sm text-danger-600">
            {errors.username}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">{t.login.password}</Label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-400" />
          <input
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
            className={`${inputBase} ${inputOk} ${errors.password ? inputError : ""} pr-12 pl-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          >
            {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-1.5 text-sm text-danger-600">
            {errors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-800 px-4 py-3 text-base font-semibold text-white shadow-md shadow-brand-700/25 transition-colors hover:from-brand-700 hover:to-brand-900 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
      >
        {pending ? t.login.submitting : t.login.submit}
      </button>
    </form>
  );
}

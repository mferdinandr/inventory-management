"use client";

import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";

type PasswordInputProps = ComponentProps<typeof Input> & {
  leftIcon?: ReactNode;
};

/** A password field with a built-in show/hide toggle (reusable everywhere). */
export function PasswordInput({ leftIcon, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </span>
      )}
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", leftIcon && "pl-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? t.login.hidePassword : t.login.showPassword}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

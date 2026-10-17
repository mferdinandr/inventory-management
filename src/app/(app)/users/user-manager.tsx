"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { RoleBadge } from "@/components/role-badge";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Notice,
} from "@/components/ui";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { type UsersState, userAction } from "./actions";

type Row = {
  id: string;
  username: string;
  name: string;
  role: keyof typeof t.roles;
  isActive: boolean;
};

const ROLES = Object.keys(t.roles) as (keyof typeof t.roles)[];

export function UserManager({ users, meId }: { users: Row[]; meId: string }) {
  const [state, action, pending] = useActionState<UsersState, FormData>(userAction, undefined);

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.ok && <Notice tone="success">{state.ok}</Notice>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.users.add}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="intent" value="create" />
            <div>
              <Label htmlFor="new-username">{t.users.username}</Label>
              <Input id="new-username" name="username" autoCapitalize="none" required />
            </div>
            <div>
              <Label htmlFor="new-name">{t.users.name}</Label>
              <Input id="new-name" name="name" required />
            </div>
            <div>
              <Label htmlFor="new-role">{t.users.role}</Label>
              <NativeSelect id="new-role" name="role" defaultValue="OPERASI">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="new-password">{t.users.password}</Label>
              <PasswordInput
                id="new-password"
                name="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {t.users.create}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {users.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t.users.empty}</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700">
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.name}</p>
                      <p className="text-sm text-muted-foreground">@{u.username}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={u.role} />
                      <Badge
                        className={cn(
                          "border-transparent",
                          u.isActive ? "bg-success-50 text-success-700" : "bg-ink-100 text-ink-600",
                        )}
                      >
                        {u.isActive ? t.users.active : t.users.inactive}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-ink-200 pt-4 md:grid-cols-2 xl:grid-cols-3">
                    <form action={action} className="space-y-1.5">
                      <input type="hidden" name="intent" value="role" />
                      <input type="hidden" name="id" value={u.id} />
                      <Label htmlFor={`role-${u.id}`}>{t.users.role}</Label>
                      <div className="flex gap-2">
                        <NativeSelect
                          id={`role-${u.id}`}
                          name="role"
                          defaultValue={u.role}
                          disabled={u.id === meId}
                          className="flex-1"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t.roles[r]}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button type="submit" variant="outline" disabled={pending || u.id === meId}>
                          {t.users.saveRole}
                        </Button>
                      </div>
                    </form>

                    <form action={action} className="space-y-1.5">
                      <input type="hidden" name="intent" value="reset" />
                      <input type="hidden" name="id" value={u.id} />
                      <Label htmlFor={`pw-${u.id}`}>{t.users.newPassword}</Label>
                      <div className="flex gap-2">
                        <PasswordInput
                          id={`pw-${u.id}`}
                          name="password"
                          minLength={8}
                          autoComplete="new-password"
                          required
                          className="flex-1"
                        />
                        <Button type="submit" variant="outline" disabled={pending}>
                          {t.users.resetPassword}
                        </Button>
                      </div>
                    </form>

                    {u.id !== meId && (
                      <form action={action} className="space-y-1.5">
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.isActive)} />
                        <Label>{t.users.status}</Label>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            variant={u.isActive ? "destructive" : "outline"}
                            disabled={pending}
                            className="flex-1"
                          >
                            {u.isActive ? t.users.deactivate : t.users.activate}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

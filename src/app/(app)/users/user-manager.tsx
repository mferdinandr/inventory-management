"use client";

import { Search } from "lucide-react";
import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { RoleBadge } from "@/components/role-badge";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
const FIELD = "h-11";

export function UserManager({ users, meId }: { users: Row[]; meId: string }) {
  const [state, action, pending] = useActionState<UsersState, FormData>(userAction, undefined);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    : users;

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.ok && <Notice tone="success">{state.ok}</Notice>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-card shadow-2xl shadow-brand-900/10">
        <div className="px-6 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
          <div className="mb-10">
            <h2 className="text-xl font-bold tracking-tight text-ink-900">{t.users.add}</h2>
          </div>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="intent" value="create" />
            <div>
              <Label htmlFor="new-username">{t.users.username}</Label>
              <Input
                id="new-username"
                name="username"
                autoCapitalize="none"
                required
                className={FIELD}
              />
            </div>
            <div>
              <Label htmlFor="new-name">{t.users.name}</Label>
              <Input id="new-name" name="name" required className={FIELD} />
            </div>
            <div>
              <Label htmlFor="new-role">{t.users.role}</Label>
              <NativeSelect id="new-role" name="role" defaultValue="OPERASI" className={FIELD}>
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
                className={FIELD}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="w-full shadow-md shadow-primary/25"
              >
                {t.users.create}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight text-ink-900">{t.users.listTitle}</h2>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.users.searchPlaceholder}
            aria-label={t.users.searchPlaceholder}
            className={cn(FIELD, "pl-10")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {q ? t.users.noMatch : t.users.empty}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => (
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
                    {u.id !== meId && (
                      <form action={action}>
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.isActive)} />
                        <Button
                          type="submit"
                          variant={u.isActive ? "destructive" : "outline"}
                          disabled={pending}
                          className="h-9"
                        >
                          {u.isActive ? t.users.deactivate : t.users.activate}
                        </Button>
                      </form>
                    )}
                  </div>

                  <div className="grid gap-4 border-t border-ink-200 pt-4 md:grid-cols-2">
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
                          className={cn(FIELD, "flex-1")}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t.roles[r]}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={pending || u.id === meId}
                          className={cn(FIELD, "w-40 shrink-0")}
                        >
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
                          className={cn(FIELD, "flex-1")}
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={pending}
                          className={cn(FIELD, "w-40 shrink-0")}
                        >
                          {t.users.resetPassword}
                        </Button>
                      </div>
                    </form>
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

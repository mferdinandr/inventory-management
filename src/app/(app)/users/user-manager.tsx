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

function UserRow({
  user,
  meId,
  action,
  pending,
}: {
  user: Row;
  meId: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState<"active" | "inactive">(
    user.isActive ? "active" : "inactive",
  );
  const [password, setPassword] = useState("");
  const dirty = role !== user.role || (status === "active") !== user.isActive || password !== "";

  return (
    <Card className="transition-colors hover:border-primary/50">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role} />
            <Badge
              className={cn(
                "border-transparent",
                user.isActive ? "bg-success-50 text-success-700" : "bg-ink-100 text-ink-600",
              )}
            >
              {user.isActive ? t.users.active : t.users.inactive}
            </Badge>
          </div>
        </div>

        {user.id !== meId && (
          <form
            action={action}
            className="grid gap-4 border-t border-ink-200 pt-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={user.id} />
            <div className="space-y-2">
              <Label htmlFor={`role-${user.id}`}>{t.users.role}</Label>
              <NativeSelect
                id={`role-${user.id}`}
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as keyof typeof t.roles)}
                className={FIELD}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`status-${user.id}`}>{t.users.status}</Label>
              <NativeSelect
                id={`status-${user.id}`}
                name="active"
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className={FIELD}
              >
                <option value="active">{t.users.active}</option>
                <option value="inactive">{t.users.inactive}</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pw-${user.id}`}>{t.users.newPassword}</Label>
              <PasswordInput
                id={`pw-${user.id}`}
                name="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={!dirty || pending}
                className={cn(FIELD, "w-full xl:w-auto xl:px-8")}
              >
                {t.users.save}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

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
            <div className="space-y-2">
              <Label htmlFor="new-username">{t.users.username}</Label>
              <Input
                id="new-username"
                name="username"
                autoCapitalize="none"
                required
                className={FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">{t.users.name}</Label>
              <Input id="new-name" name="name" required className={FIELD} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">{t.users.role}</Label>
              <NativeSelect id="new-role" name="role" defaultValue="OPERASI" className={FIELD}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
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
              <UserRow user={u} meId={meId} action={action} pending={pending} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { ActionToast } from "@/components/toaster";
import { Button, Input, Label, Select } from "@/components/ui";
import { t } from "@/lib/strings";
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
        <ActionToast state={state} />
      </div>

      <form
        action={action}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="intent" value="create" />
        <h2 className="text-lg font-semibold sm:col-span-2">{t.users.add}</h2>
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
          <Select id="new-role" name="role" defaultValue="OPERASI">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="new-password">{t.users.password}</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
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

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {users.map((u) => (
          <li key={u.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{u.name}</span>
              <span className="text-slate-500">@{u.username}</span>
              <span className={u.isActive ? "text-emerald-700" : "text-slate-500"}>
                {u.isActive ? t.users.active : t.users.inactive}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <form action={action} className="flex items-end gap-2">
                <input type="hidden" name="intent" value="role" />
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <Label htmlFor={`role-${u.id}`}>{t.users.role}</Label>
                  <Select
                    id={`role-${u.id}`}
                    name="role"
                    defaultValue={u.role}
                    disabled={u.id === meId}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t.roles[r]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary" disabled={pending || u.id === meId}>
                  OK
                </Button>
              </form>

              <form action={action} className="flex items-end gap-2">
                <input type="hidden" name="intent" value="reset" />
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <Label htmlFor={`pw-${u.id}`}>{t.users.newPassword}</Label>
                  <Input
                    id={`pw-${u.id}`}
                    name="password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={pending}>
                  {t.users.resetPassword}
                </Button>
              </form>

              {u.id !== meId && (
                <form action={action}>
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="active" value={String(!u.isActive)} />
                  <Button
                    type="submit"
                    variant={u.isActive ? "danger" : "secondary"}
                    disabled={pending}
                  >
                    {u.isActive ? t.users.deactivate : t.users.activate}
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

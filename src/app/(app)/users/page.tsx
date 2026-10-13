import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { listUsers } from "@/server/services/user.service";
import { UserManager } from "./user-manager";

export const metadata: Metadata = { title: t.users.title };

export default async function UsersPage() {
  const me = await requireAction("user.manage");
  const users = await listUsers();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t.users.title}</h1>
      <UserManager users={users} meId={me.id} />
    </section>
  );
}

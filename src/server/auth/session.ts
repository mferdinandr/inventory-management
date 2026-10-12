import { redirect } from "next/navigation";
import { cache } from "react";
import { type Action, can, type Role } from "@/lib/permissions";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { auth } from "./config";

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

/** The signed-in user as stored now, or null when signed out or deactivated. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      mustChangePassword: true,
      isActive: true,
    },
  });
  if (!user?.isActive) return null;
  const { isActive: _isActive, ...rest } = user;
  return rest;
});

/** For pages: redirect to login, or to the password change page when one is due. */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/change-password");
  return user;
}

/** For pages: redirect home when the role never gets this action. */
export async function requireAction(action: Action) {
  const user = await requireUser();
  if (!can(user.role, action)) redirect("/");
  return user;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertAction(action: Action): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu");
  if (user.mustChangePassword) throw new AppError("FORBIDDEN", "Ganti kata sandi terlebih dahulu");
  if (!can(user.role, action)) throw new AppError("FORBIDDEN", "Peran Anda tidak berwenang");
  return user;
}

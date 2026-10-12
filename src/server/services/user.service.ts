import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  type CreateUserInput,
  createUserSchema,
  passwordSchema,
  type UpdateUserInput,
  updateUserSchema,
} from "@/lib/validators/user";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

const publicSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof publicSelect }>;

function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Masukan tidak valid",
    );
  }
  return result.data;
}

export function listUsers(): Promise<UserSummary[]> {
  return db.user.findMany({
    select: publicSelect,
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
  });
}

/** New users must change the password the administrator typed for them. */
export async function createUser(input: CreateUserInput): Promise<UserSummary> {
  const data = parse(createUserSchema, input);
  try {
    return await db.user.create({
      data: {
        username: data.username,
        name: data.name,
        role: data.role,
        passwordHash: await hashPassword(data.password),
        mustChangePassword: true,
      },
      select: publicSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("VALIDATION_ERROR", "Username sudah dipakai");
    }
    throw e;
  }
}

/**
 * Change name, role or active flag. There must always be at least one active SUPERADMIN, so
 * the active superadmins are locked for the duration of the check.
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserSummary> {
  const data = parse(updateUserSchema, input);

  return db.$transaction(async (tx) => {
    const admins = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'SUPERADMIN' AND is_active FOR UPDATE`;
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan");

    const wasActiveAdmin = target.role === "SUPERADMIN" && target.isActive;
    const willBeActiveAdmin =
      (data.role ?? target.role) === "SUPERADMIN" && (data.isActive ?? target.isActive);
    if (wasActiveAdmin && !willBeActiveAdmin && admins.length <= 1) {
      throw new AppError("LAST_SUPERADMIN", "Harus tersisa minimal satu Superadmin aktif");
    }

    return tx.user.update({ where: { id }, data, select: publicSelect });
  });
}

/** An administrator sets a new password; the user must change it at the next login. */
export async function resetPassword(id: string, password: string): Promise<void> {
  const next = parse(passwordSchema, password);
  const result = await db.user.updateMany({
    where: { id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: true },
  });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan");
}

export async function changeOwnPassword(id: string, current: string, next: string): Promise<void> {
  const password = parse(passwordSchema, next);
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !(await verifyPassword(user.passwordHash, current))) {
    throw new AppError("VALIDATION_ERROR", "Kata sandi saat ini salah");
  }
  if (current === password) {
    throw new AppError("VALIDATION_ERROR", "Kata sandi baru harus berbeda dari yang lama");
  }
  await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });
}

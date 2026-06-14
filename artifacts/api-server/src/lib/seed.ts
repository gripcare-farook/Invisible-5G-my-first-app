import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

type UserRole = "admin" | "transport" | "labour_contractor" | "labour_worker";

interface SeedUser {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

async function upsertUser(u: SeedUser): Promise<void> {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, u.email)).limit(1);
  if (existing.length > 0) {
    await db.update(usersTable).set({ name: u.name, role: u.role, passwordHash: u.passwordHash, isActive: true }).where(eq(usersTable.email, u.email));
    logger.info({ email: u.email }, "seed: updated user");
  } else {
    await db.insert(usersTable).values({ email: u.email, name: u.name, role: u.role, passwordHash: u.passwordHash, isActive: true });
    logger.info({ email: u.email }, "seed: created user");
  }
}

const STATIC_USERS: Array<{ email: string; name: string; role: UserRole; password: string }> = [
  { email: "8122676635", name: "Javith Bai",  role: "transport",          password: "admin" },
  { email: "9087177507", name: "Pallavan",     role: "labour_contractor",  password: "admin" },
  { email: "7397271927", name: "Naresh",       role: "labour_worker",      password: "admin" },
];

export async function seedUsers(): Promise<void> {
  const adminEmail = process.env["ADMIN_EMAIL"];
  const adminPasswordHash = process.env["ADMIN_PASSWORD_HASH"];
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (adminEmail && (adminPasswordHash || adminPassword)) {
    const hash = adminPasswordHash ?? (await bcrypt.hash(adminPassword!, 12));
    await upsertUser({ email: adminEmail.toLowerCase().trim(), name: "Admin", role: "admin", passwordHash: hash });
  }

  for (const u of STATIC_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await upsertUser({ email: u.email, name: u.name, role: u.role, passwordHash: hash });
  }
}

import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface SeedUser {
  email: string;
  name: string;
  role: "admin" | "transport";
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

export async function seedUsers(): Promise<void> {
  const adminEmail = process.env["ADMIN_EMAIL"];
  const adminPasswordHash = process.env["ADMIN_PASSWORD_HASH"];
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (adminEmail && (adminPasswordHash || adminPassword)) {
    const hash = adminPasswordHash ?? (await bcrypt.hash(adminPassword!, 12));
    await upsertUser({ email: adminEmail, name: "Admin", role: "admin", passwordHash: hash });
  }

  const driverEmail = process.env["JAVITH_BAI_EMAIL"];
  const driverPasswordHash = process.env["JAVITH_BAI_INITIAL_PASSWORD_HASH"];
  const driverPassword = process.env["JAVITH_BAI_INITIAL_PASSWORD"];

  if (driverEmail && (driverPasswordHash || driverPassword)) {
    const hash = driverPasswordHash ?? (await bcrypt.hash(driverPassword!, 12));
    await upsertUser({ email: driverEmail, name: "Javith Bai", role: "transport", passwordHash: hash });
  }
}

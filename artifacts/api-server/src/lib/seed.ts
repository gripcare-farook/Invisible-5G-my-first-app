import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

type UserRole = "admin" | "transport" | "labour_contractor" | "labour_worker";

interface SeedUser {
  email: string;
  name: string;
  role: UserRole;
}

const STATIC_USERS: SeedUser[] = [
  { email: "8122676635", name: "Javith Bai", role: "transport" },
  { email: "9087177507", name: "Pallavan", role: "labour_contractor" },
  { email: "7397271927", name: "Naresh", role: "labour_worker" },
];

export async function seedUsers(): Promise<void> {
  let created = 0;
  let updated = 0;
  const adminEmail = process.env["ADMIN_EMAIL"]?.toLowerCase().trim();
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (adminEmail && adminPassword) {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, adminEmail)).limit(1);
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db
      .insert(usersTable)
      .values({ email: adminEmail, name: "Admin", role: "admin", passwordHash, isActive: true })
      .onConflictDoUpdate({
        target: usersTable.email,
        set: { name: "Admin", role: "admin", passwordHash, isActive: true },
      });
    existing.length ? updated++ : created++;
  }

  for (const u of STATIC_USERS) {
    const existing = await db
      .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, u.email))
      .limit(1);
    if (existing.length) {
      await db
        .update(usersTable)
        .set({
          name: u.name,
          role: u.role,
          isActive: true,
          ...(!existing[0]!.passwordHash && { passwordHash: await bcrypt.hash("admin", 10) }),
        })
        .where(eq(usersTable.email, u.email));
      updated++;
    } else {
      await db.insert(usersTable).values({
        ...u,
        passwordHash: await bcrypt.hash("admin", 10),
        isActive: true,
      });
      created++;
    }
  }

  logger.info({ created, updated }, "seed: users ensured");
}

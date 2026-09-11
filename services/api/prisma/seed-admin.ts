// Idempotent super-admin seed. Run: npm run seed:admin
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? "admin@mastimalai.com";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "Masti@12345";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, isActive: true, role: "SUPER_ADMIN" },
    create: { email, name: "Super Admin", passwordHash, role: "SUPER_ADMIN" },
  });

  // A demo content-admin to show RBAC differences.
  const contentEmail = "content@mastimalai.com";
  await prisma.adminUser.upsert({
    where: { email: contentEmail },
    update: {},
    create: {
      email: contentEmail,
      name: "Content Editor",
      passwordHash: await bcrypt.hash("Content@12345", 10),
      role: "CONTENT_ADMIN",
    },
  });

  console.log(`Admin seed complete.
  SUPER_ADMIN   -> ${admin.email} / ${password}
  CONTENT_ADMIN -> ${contentEmail} / Content@12345`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

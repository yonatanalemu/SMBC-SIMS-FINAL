// Run with: npm run reset-admin -- <role>
// Defaults to resetting the admin account if no role is passed.
import "dotenv/config";
import prisma from "../src/config/prisma.js";
import { hashPassword, generateTempPassword } from "../src/utils/auth.js";

async function main() {
  const role = process.argv[2] || "admin";
  if (!["admin", "registrar", "finance"].includes(role)) {
    console.log("Usage: npm run reset-admin -- <admin|registrar|finance>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { role } });
  if (!user) {
    console.log(`No ${role} account exists yet — run \`npm run seed\` instead.`);
    return;
  }

  const tempPassword = generateTempPassword(role.slice(0, 3).toUpperCase());
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  });

  console.log(`${role} password reset:`);
  console.log(`  username: ${user.username}`);
  console.log(`  new temporary password: ${tempPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

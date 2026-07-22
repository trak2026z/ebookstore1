import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { UserRole } from "../src/generated/prisma/enums.js";
import { normalizeEmail } from "../src/users/normalize-email.js";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function getAdminSeedConfiguration():
  | {
      email: string;
      password: string;
      displayName: string;
    }
  | undefined {
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Administrator";

  if (rawEmail === undefined && password === undefined) {
    return undefined;
  }

  if (rawEmail === undefined || rawEmail.trim().length === 0) {
    throw new Error("ADMIN_EMAIL is required when ADMIN_PASSWORD is configured.");
  }

  if (password === undefined || password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  if (displayName.length > 120) {
    throw new Error("ADMIN_DISPLAY_NAME must contain at most 120 characters.");
  }

  return {
    email: normalizeEmail(rawEmail),
    password,
    displayName,
  };
}

async function seedAdministrator(): Promise<void> {
  const configuration = getAdminSeedConfiguration();

  if (configuration === undefined) {
    return;
  }

  const existingAdministrator = await prisma.user.findUnique({
    where: { email: configuration.email },
    select: { id: true },
  });

  if (existingAdministrator !== null) {
    await prisma.user.update({
      where: { id: existingAdministrator.id },
      data: {
        displayName: configuration.displayName,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    return;
  }

  const passwordHash = await argon2.hash(configuration.password, {
    type: argon2.argon2id,
  });

  await prisma.user.create({
    data: {
      email: configuration.email,
      passwordHash,
      displayName: configuration.displayName,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
}

async function main(): Promise<void> {
  const category = await prisma.category.upsert({
    where: { slug: "programowanie" },
    update: { name: "Programowanie" },
    create: { name: "Programowanie", slug: "programowanie" },
  });

  const author = await prisma.author.upsert({
    where: { slug: "marcin-kowalski" },
    update: { name: "Marcin Kowalski" },
    create: { name: "Marcin Kowalski", slug: "marcin-kowalski" },
  });

  await prisma.book.upsert({
    where: { slug: "typescript-w-praktyce" },
    update: {
      title: "TypeScript w praktyce",
      description: "Praktyczne wzorce tworzenia bezpiecznych aplikacji TypeScript.",
      priceCents: 7990,
      authorId: author.id,
      categoryId: category.id,
      isActive: true,
    },
    create: {
      title: "TypeScript w praktyce",
      slug: "typescript-w-praktyce",
      description: "Praktyczne wzorce tworzenia bezpiecznych aplikacji TypeScript.",
      priceCents: 7990,
      authorId: author.id,
      categoryId: category.id,
    },
  });

  await seedAdministrator();
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });

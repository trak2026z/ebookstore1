import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

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
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });

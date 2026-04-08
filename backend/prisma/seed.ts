import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      passwordHash,
      name: 'Alice Johnson',
      isVerified: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      passwordHash,
      name: 'Bob Smith',
      isVerified: true,
    },
  });

  // Create root folders
  await prisma.folder.upsert({
    where: { id: 'root-alice' },
    update: {},
    create: {
      id: 'root-alice',
      name: 'root',
      ownerId: alice.id,
      path: '/',
    },
  });

  await prisma.folder.upsert({
    where: { id: 'root-bob' },
    update: {},
    create: {
      id: 'root-bob',
      name: 'root',
      ownerId: bob.id,
      path: '/',
    },
  });

  console.log('Seeding complete.');
  console.log('  alice@example.com / Password123!');
  console.log('  bob@example.com   / Password123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

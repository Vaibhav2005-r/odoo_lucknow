import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const hash = (p) => bcrypt.hash(p, 10);

async function main() {
  console.log('Seeding initial data (Hour 1: users, taxes, payment terms)...');

  // Users
  await prisma.user.upsert({
    where: { email: 'admin@brightloop.in' },
    update: {},
    create: {
      name: 'Asha Admin',
      email: 'admin@brightloop.in',
      role: 'ADMIN',
      passwordHash: await hash('Admin@12345'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@brightloop.in' },
    update: {},
    create: {
      name: 'Sam Staff',
      email: 'staff@brightloop.in',
      role: 'STAFF',
      passwordHash: await hash('Staff@12345'),
    },
  });

  await prisma.user.upsert({
    where: { email: 'riya@sharmaretail.in' },
    update: {},
    create: {
      name: 'Riya Sharma',
      email: 'riya@sharmaretail.in',
      role: 'CUSTOMER',
      passwordHash: await hash('Customer@123'),
    },
  });

  // Taxes
  await prisma.tax.upsert({
    where: { name: 'GST 18%' },
    update: {},
    create: { name: 'GST 18%', rate: 18 },
  });

  await prisma.tax.upsert({
    where: { name: 'GST 5%' },
    update: {},
    create: { name: 'GST 5%', rate: 5 },
  });

  // Payment terms
  await prisma.paymentTerm.upsert({
    where: { name: 'Immediate' },
    update: {},
    create: { name: 'Immediate', dueDays: 0 },
  });

  await prisma.paymentTerm.upsert({
    where: { name: '15 Days' },
    update: {},
    create: { name: '15 Days', dueDays: 15 },
  });

  await prisma.paymentTerm.upsert({
    where: { name: '30 Days' },
    update: {},
    create: { name: '30 Days', dueDays: 30 },
  });

  console.log('Base seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

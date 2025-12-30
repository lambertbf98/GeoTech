import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding license types...');

  const licenseTypes = [
    {
      name: 'Diaria',
      code: 'daily',
      durationDays: 1,
      price: 2.99,
      description: 'Licencia valida por 24 horas'
    },
    {
      name: 'Mensual',
      code: 'monthly',
      durationDays: 30,
      price: 9.99,
      description: 'Licencia valida por 30 dias'
    },
    {
      name: 'Trimestral',
      code: 'quarterly',
      durationDays: 90,
      price: 24.99,
      description: 'Licencia valida por 3 meses'
    },
    {
      name: 'Anual',
      code: 'yearly',
      durationDays: 365,
      price: 79.99,
      description: 'Licencia valida por 1 ano'
    }
  ];

  for (const type of licenseTypes) {
    await prisma.licenseType.upsert({
      where: { code: type.code },
      update: {},
      create: type
    });
    console.log(`Created/updated license type: ${type.name}`);
  }

  console.log('License types seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

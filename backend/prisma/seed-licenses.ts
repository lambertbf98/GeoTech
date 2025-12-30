import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Email del administrador - cambia esto por tu email
const ADMIN_EMAIL = 'gfmemorieswork@gmail.com';

async function main() {
  console.log('=== GeoTech License System Setup ===\n');

  // 1. Crear tipos de licencia
  console.log('1. Creando tipos de licencia...');
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
      update: { price: type.price, durationDays: type.durationDays },
      create: type
    });
    console.log(`   - ${type.name}: ${type.price} EUR (${type.durationDays} dias)`);
  }

  // 2. Crear o actualizar usuario admin
  console.log('\n2. Configurando usuario administrador...');
  const existingUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL }
  });

  if (existingUser) {
    // Actualizar a admin si ya existe
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { isAdmin: true }
    });
    console.log(`   Usuario ${ADMIN_EMAIL} actualizado como administrador`);
  } else {
    // Crear nuevo usuario admin
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        name: 'Administrador',
        isAdmin: true
      }
    });
    console.log(`   Usuario admin creado: ${ADMIN_EMAIL}`);
    console.log(`   Password temporal: Admin123! (CAMBIALA DESPUES)`);
  }

  console.log('\n=== Setup completado! ===');
  console.log(`\nAccede al panel de admin en: /admin`);
  console.log(`Email: ${ADMIN_EMAIL}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

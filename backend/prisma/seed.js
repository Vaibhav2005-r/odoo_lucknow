// Run on an empty database (npm run db:reset does migrate + seed).
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { todayIn, addDays, addPeriods, fmtDate } from '../src/lib/billing-core.js';
import { createSubscription, confirm } from '../src/modules/subscriptions/subscriptions.service.js';
import { runBilling } from '../src/modules/billing/billing.service.js';
import { confirmInvoices } from '../src/modules/invoices/invoices.service.js';
import { recordPayment } from '../src/modules/payments/payments.service.js';

const today = todayIn();
const hash = (p) => bcrypt.hash(p, 10);
const monthsAgo = (n) => addPeriods(today, 'MONTHLY', -n);

async function main() {
  console.log('Starting full demo seed...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@brightloop.in' },
    update: {},
    create: { name: 'Asha Admin', email: 'admin@brightloop.in', role: 'ADMIN', passwordHash: await hash('Admin@12345') },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@brightloop.in' },
    update: {},
    create: { name: 'Sam Staff', email: 'staff@brightloop.in', role: 'STAFF', passwordHash: await hash('Staff@12345') },
  });

  const riyaUser = await prisma.user.upsert({
    where: { email: 'riya@sharmaretail.in' },
    update: {},
    create: { name: 'Riya Sharma', email: 'riya@sharmaretail.in', role: 'CUSTOMER', passwordHash: await hash('Customer@123') },
  });

  const gst18 = await prisma.tax.upsert({
    where: { name: 'GST 18%' },
    update: {},
    create: { name: 'GST 18%', rate: 18 },
  });

  const gst5 = await prisma.tax.upsert({
    where: { name: 'GST 5%' },
    update: {},
    create: { name: 'GST 5%', rate: 5 },
  });

  const immediate = await prisma.paymentTerm.upsert({
    where: { name: 'Immediate' },
    update: {},
    create: { name: 'Immediate', dueDays: 0 },
  });

  const net15 = await prisma.paymentTerm.upsert({
    where: { name: '15 Days' },
    update: {},
    create: { name: '15 Days', dueDays: 15 },
  });

  const net30 = await prisma.paymentTerm.upsert({
    where: { name: '30 Days' },
    update: {},
    create: { name: '30 Days', dueDays: 30 },
  });

  let crm = await prisma.product.findFirst({ where: { name: 'Brightloop CRM' }, include: { variants: true } });
  if (!crm) {
    crm = await prisma.product.create({
      data: {
        name: 'Brightloop CRM',
        type: 'SERVICE',
        salesPrice: 1200,
        costPrice: 300,
        notes: 'Core CRM seat',
        taxes: { connect: [{ id: gst18.id }] },
        variants: {
          create: [
            { attribute: 'Brand', value: 'Standard', extraPrice: 0 },
            { attribute: 'Brand', value: 'Odoo', extraPrice: 560 }, // PDF example
          ],
        },
      },
      include: { variants: true },
    });
  }

  const odooVariant = crm.variants.find((v) => v.value === 'Odoo') || crm.variants[0];

  let analytics = await prisma.product.findFirst({ where: { name: 'Brightloop Analytics' } });
  if (!analytics) {
    analytics = await prisma.product.create({
      data: {
        name: 'Brightloop Analytics',
        type: 'SERVICE',
        salesPrice: 2000,
        costPrice: 500,
        taxes: { connect: [{ id: gst18.id }] },
      },
    });
  }

  let storage = await prisma.product.findFirst({ where: { name: 'Extra Storage 100 GB' } });
  if (!storage) {
    storage = await prisma.product.create({
      data: {
        name: 'Extra Storage 100 GB',
        type: 'ADDON',
        salesPrice: 299,
        costPrice: 50,
        taxes: { connect: [{ id: gst18.id }] },
      },
    });
  }

  let support = await prisma.product.findFirst({ where: { name: 'Priority Support' } });
  if (!support) {
    support = await prisma.product.create({
      data: {
        name: 'Priority Support',
        type: 'ADDON',
        salesPrice: 999,
        costPrice: 200,
        taxes: { connect: [{ id: gst18.id }] },
      },
    });
  }

  const from = addDays(today, -400);

  const crmMonthly = await prisma.plan.upsert({
    where: { name: 'CRM Monthly' },
    update: {},
    create: {
      name: 'CRM Monthly',
      productId: crm.id,
      price: 1200,
      billingPeriod: 'MONTHLY',
      minQuantity: 1,
      startDate: from,
      closable: true,
      pausable: true,
      renewable: true,
    },
  });

  const crmYearly = await prisma.plan.upsert({
    where: { name: 'CRM Yearly' },
    update: {},
    create: {
      name: 'CRM Yearly',
      productId: crm.id,
      price: 12000,
      billingPeriod: 'YEARLY',
      minQuantity: 5,
      startDate: from,
      closable: false,
      pausable: false,
      renewable: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Analytics Weekly' },
    update: {},
    create: {
      name: 'Analytics Weekly',
      productId: analytics.id,
      price: 600,
      billingPeriod: 'WEEKLY',
      startDate: from,
      pausable: true,
    },
  });

  const trial = await prisma.plan.upsert({
    where: { name: 'CRM Daily Trial' },
    update: {},
    create: {
      name: 'CRM Daily Trial',
      productId: crm.id,
      price: 50,
      billingPeriod: 'DAILY',
      startDate: from,
      autoClose: true,
      renewable: false,
    },
  });

  await prisma.discount.upsert({
    where: { name: 'Bulk seats 10%' },
    update: {},
    create: {
      name: 'Bulk seats 10%',
      type: 'PERCENTAGE',
      value: 10,
      scope: 'PRODUCT',
      minQuantity: 10,
      startDate: addDays(today, -60),
      endDate: addDays(today, 60),
      usageLimit: 100,
      products: { connect: [{ id: crm.id }] },
    },
  });

  const loyalty = await prisma.discount.upsert({
    where: { name: 'Loyalty ₹500 off' },
    update: {},
    create: {
      name: 'Loyalty ₹500 off',
      type: 'FIXED',
      value: 500,
      scope: 'SUBSCRIPTION',
      minPurchase: 5000,
      usageLimit: 3,
    },
  });

  let enterprise = await prisma.quotationTemplate.findUnique({ where: { name: 'Enterprise Yearly' } });
  if (!enterprise) {
    enterprise = await prisma.quotationTemplate.create({
      data: {
        name: 'Enterprise Yearly',
        planId: crmYearly.id,
        paymentTermId: net30.id,
        validityDays: 15,
        lines: {
          create: [
            { productId: crm.id, variantId: odooVariant?.id || null, quantity: 10 },
            { productId: support.id, quantity: 1 },
          ],
        },
      },
    });
  }

  let smallShop = await prisma.quotationTemplate.findUnique({ where: { name: 'Small Shop Monthly' } });
  if (!smallShop) {
    smallShop = await prisma.quotationTemplate.create({
      data: {
        name: 'Small Shop Monthly',
        planId: crmMonthly.id,
        paymentTermId: immediate.id,
        validityDays: 7,
        lines: {
          create: [
            { productId: crm.id, quantity: 2 },
            { productId: storage.id, quantity: 1 },
          ],
        },
      },
    });
  }

  const riya = await prisma.customer.upsert({
    where: { email: 'riya@sharmaretail.in' },
    update: {},
    create: {
      name: 'Sharma Retail',
      email: 'riya@sharmaretail.in',
      company: 'Sharma Retail',
      phone: '9820000001',
      address: 'Andheri West, Mumbai',
      userId: riyaUser.id,
    },
  });

  const big = await prisma.customer.upsert({
    where: { email: 'accounts@mehtalogistics.in' },
    update: {},
    create: {
      name: 'Mehta Logistics Pvt Ltd',
      email: 'accounts@mehtalogistics.in',
      company: 'Mehta Logistics',
      gstin: '27AAAAA0000A1Z5',
      address: 'BKC, Mumbai',
    },
  });

  const others = await Promise.all(
    ['Patel Stores', 'Iyer Clinics', 'Khan Textiles', 'Desai Bakery'].map((name, i) =>
      prisma.customer.upsert({
        where: { email: `owner${i + 1}@${name.split(' ')[0].toLowerCase()}.in` },
        update: {},
        create: { name, email: `owner${i + 1}@${name.split(' ')[0].toLowerCase()}.in` },
      }),
    ),
  );

  // ---- Demo subscriptions, invoices and payments (only on a fresh database) ----
  if ((await prisma.subscription.count()) === 0) {
    const staffUser = { id: staff.id };
    const newSub = (input) => createSubscription({ paymentTermId: immediate.id, ...input }, staffUser);

    // Active monthly CRM for Riya, 3 months in, Odoo brand on 3 seats, with the Storage add-on.
    const riyaSub = await newSub({
      customerId: riya.id,
      planId: crmMonthly.id,
      startDate: fmtDate(monthsAgo(3)),
      lines: [
        { productId: crm.id, variantId: odooVariant.id, quantity: 3 },
        { productId: storage.id, quantity: 1 },
      ],
    });
    await confirm(riyaSub.id, staff.id, 'Seed data');

    // Yearly enterprise deal from a template with the loyalty discount.
    const mehtaSub = await newSub({
      customerId: big.id,
      templateId: enterprise.id,
      startDate: fmtDate(addDays(today, -30)),
      discountId: loyalty.id,
    });
    await confirm(mehtaSub.id, staff.id, 'Seed data');

    // A quotation waiting for the customer, and a draft still being prepared.
    await newSub({ customerId: others[0].id, templateId: smallShop.id, startDate: fmtDate(addDays(today, 5)), sendQuotation: true });
    await newSub({ customerId: others[1].id, planId: crmMonthly.id, startDate: fmtDate(addDays(today, 10)), lines: [{ productId: crm.id, quantity: 4 }] });

    await runBilling(today);

    // Confirm every invoice, pay the older ones so paid / outstanding / overdue are all visible.
    const invoices = await prisma.invoice.findMany({ orderBy: { periodStart: 'asc' } });
    await confirmInvoices(invoices.map((i) => i.id));
    for (const [n, inv] of invoices.entries()) {
      if (n % 3 === 2) continue; // leave some unpaid
      if (inv.periodStart > addDays(today, -35)) continue; // keep the latest period open
      await recordPayment(
        inv.id,
        { amount: Number(inv.amountTotal), method: n % 2 ? 'UPI' : 'BANK_TRANSFER', paymentDate: fmtDate(inv.periodStart), note: 'Seed payment' },
        admin.id,
      );
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

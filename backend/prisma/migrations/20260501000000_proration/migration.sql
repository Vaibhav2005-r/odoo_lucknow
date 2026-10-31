-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('RECURRING', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'APPLIED');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "kind" "InvoiceKind" NOT NULL DEFAULT 'RECURRING';

-- CreateTable
CREATE TABLE "SubscriptionCredit" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "productId" INTEGER,
    "hsnSac" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxes" JSONB NOT NULL DEFAULT '[]',
    "periodStart" DATE,
    "periodEnd" DATE,
    "invoiceId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionCredit_subscriptionId_status_idx" ON "SubscriptionCredit"("subscriptionId", "status");

-- AddForeignKey
ALTER TABLE "SubscriptionCredit" ADD CONSTRAINT "SubscriptionCredit_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCredit" ADD CONSTRAINT "SubscriptionCredit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;


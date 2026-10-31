-- CreateEnum
CREATE TYPE "TaxKind" AS ENUM ('GST', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('INVOICE_DUE_SOON', 'INVOICE_OVERDUE', 'RENEWAL_UPCOMING');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REVIEW');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "stateCode" TEXT;

-- AlterTable
ALTER TABLE "Tax" ADD COLUMN     "kind" "TaxKind" NOT NULL DEFAULT 'GST';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hsnSac" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "amountCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amountIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amountOtherTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amountSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "interState" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeOfSupply" TEXT,
ADD COLUMN     "supplierGstin" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsnSac" TEXT,
ADD COLUMN     "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherTaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "stage" INTEGER NOT NULL,
    "invoiceId" INTEGER,
    "subscriptionId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "createdById" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationLog_customerId_idx" ON "NotificationLog"("customerId");

-- CreateIndex
CREATE INDEX "NotificationLog_invoiceId_idx" ON "NotificationLog"("invoiceId");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerOrderId_key" ON "PaymentIntent"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentIntent_invoiceId_idx" ON "PaymentIntent"("invoiceId");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


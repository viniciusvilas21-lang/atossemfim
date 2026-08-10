-- CreateEnum
CREATE TYPE "CarouselOverride" AS ENUM ('AUTO', 'FORCE_SHOW', 'FORCE_HIDE');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_AUTHORIZATION', 'ACTIVE', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'PAID', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "Supporter" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "instagram" TEXT,
    "email" TEXT NOT NULL,
    "cpf" TEXT,
    "displayName" TEXT,
    "allowPublicDisplay" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "acceptedPrivacyAt" TIMESTAMP(3) NOT NULL,
    "carouselOverride" "CarouselOverride" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "supporterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "openpixCorrelationId" TEXT NOT NULL,
    "openpixChargeId" TEXT,
    "openpixGlobalId" TEXT,
    "brCode" TEXT,
    "qrCodeImage" TEXT,
    "paymentLinkUrl" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "supporterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "billingDay" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_AUTHORIZATION',
    "openpixSubscriptionGlobalId" TEXT,
    "openpixCorrelationId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "openpixCorrelationId" TEXT NOT NULL,
    "openpixChargeId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "SubscriptionChargeStatus" NOT NULL DEFAULT 'CREATED',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supporter_email_key" ON "Supporter"("email");

-- CreateIndex
CREATE INDEX "Supporter_allowPublicDisplay_idx" ON "Supporter"("allowPublicDisplay");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_openpixCorrelationId_key" ON "Donation"("openpixCorrelationId");

-- CreateIndex
CREATE INDEX "Donation_supporterId_idx" ON "Donation"("supporterId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_openpixSubscriptionGlobalId_key" ON "Subscription"("openpixSubscriptionGlobalId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_openpixCorrelationId_key" ON "Subscription"("openpixCorrelationId");

-- CreateIndex
CREATE INDEX "Subscription_supporterId_idx" ON "Subscription"("supporterId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_openpixCorrelationId_key" ON "SubscriptionCharge"("openpixCorrelationId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_idx" ON "SubscriptionCharge"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "Supporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "Supporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

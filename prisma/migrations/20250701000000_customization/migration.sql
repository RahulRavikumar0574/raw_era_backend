-- CreateEnum
CREATE TYPE "CustomizationRequestStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "customization_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "description" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "status" "CustomizationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customization_images" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customization_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_requests" ADD CONSTRAINT "customization_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_images" ADD CONSTRAINT "customization_images_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customization_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

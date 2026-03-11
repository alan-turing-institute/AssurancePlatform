-- AlterTable
ALTER TABLE "users" ADD COLUMN "completed_tours" TEXT[] DEFAULT ARRAY[]::TEXT[];

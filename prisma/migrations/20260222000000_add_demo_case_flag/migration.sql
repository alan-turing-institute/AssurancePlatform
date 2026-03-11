-- Add demo case flag to assurance cases
ALTER TABLE "assurance_cases" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

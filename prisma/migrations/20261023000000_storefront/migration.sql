-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "code" TEXT,
ADD COLUMN     "inMenu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isHot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTool" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ManualMethod" ADD COLUMN     "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "countryMode" TEXT NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'post',
ADD COLUMN     "toolName" TEXT,
ADD COLUMN     "version" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cardStyle" TEXT NOT NULL DEFAULT 'ink',
ADD COLUMN     "cardTag" JSONB,
ADD COLUMN     "cardTitle" JSONB,
ADD COLUMN     "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "countryMode" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "hideFromGoogle" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HomeSlide" (
    "id" TEXT NOT NULL,
    "tag" JSONB NOT NULL DEFAULT '{}',
    "label" JSONB NOT NULL DEFAULT '{}',
    "title" JSONB NOT NULL,
    "bullets" JSONB NOT NULL DEFAULT '{}',
    "buttonText" JSONB NOT NULL DEFAULT '{}',
    "buttonHref" TEXT NOT NULL DEFAULT '/',
    "button2Text" JSONB NOT NULL DEFAULT '{}',
    "button2Href" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "countryMode" TEXT NOT NULL DEFAULT 'all',
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSlide_pkey" PRIMARY KEY ("id")
);


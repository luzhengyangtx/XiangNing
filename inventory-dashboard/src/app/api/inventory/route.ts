import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";
  const sortCol = searchParams.get("sortCol");
  const sortDir = searchParams.get("sortDir") || "asc";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
    ];
  }
  if (category !== "all") {
    where.category = category;
  }

  const orderBy: Record<string, string> = {};
  if (sortCol && ["name", "sku", "currentStock", "price", "category"].includes(sortCol)) {
    orderBy[sortCol] = sortDir;
  } else {
    orderBy["createdAt"] = "desc";
  }

  const [products, totalCount, lowStockCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      include: {
        platformLinks: {
          include: { platform: true },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.count({
      where: {
        currentStock: { lt: prisma.product.fields.safetyStock },
      },
    }),
  ]);

  // Count today's sync failures
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const syncFailures = await prisma.syncTask.count({
    where: {
      status: { in: ["failed", "partial_fail"] },
      createdAt: { gte: today },
    },
  });

  // Transform data for frontend
  const items = products.map((p) => {
    const platformStatus: Record<string, string> = {};
    for (const link of p.platformLinks) {
      platformStatus[link.platform.code] = link.syncStatus;
    }
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      currentStock: p.currentStock,
      safetyStock: p.safetyStock,
      price: p.price,
      unit: p.unit,
      platformStatus,
    };
  });

  // Get unique categories
  const categories = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
  });

  return NextResponse.json({
    items,
    totalCount,
    lowStockCount,
    syncFailures,
    categories: categories.map((c) => c.category),
  });
}

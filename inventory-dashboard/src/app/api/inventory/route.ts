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
      { title: { contains: search } },
      { sku: { contains: search } },
    ];
  }
  if (category !== "all") {
    where.categoryL1 = category;
  }

  const orderBy: Record<string, string> = {};
  const allowedSorts = ["title", "sku", "originalPrice", "discountPrice", "categoryL1", "createdAt"];
  if (sortCol && allowedSorts.includes(sortCol)) {
    orderBy[sortCol] = sortDir;
  } else {
    orderBy["createdAt"] = "desc";
  }

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      warehouseStocks: { include: { warehouse: true } },
      platformLinks: { include: { platform: true } },
    },
  });

  const totalCount = await prisma.product.count({ where });

  const allProducts = await prisma.product.findMany({
    include: { warehouseStocks: true },
  });
  const lowStockCount = allProducts.filter((p) => {
    const total = p.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);
    return total < p.safetyStock;
  }).length;

  // Today's sync failures
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const syncFailures = await prisma.syncTask.count({
    where: { status: { in: ["failed", "partial_fail"] }, createdAt: { gte: today } },
  });

  // Transform for frontend
  const items = products.map((p) => {
    const totalStock = p.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);
    const platformStatus: Record<string, string> = {};
    for (const link of p.platformLinks) {
      platformStatus[link.platform.code] = link.syncStatus;
    }
    return {
      id: p.id,
      title: p.title,
      sku: p.sku,
      categoryL1: p.categoryL1,
      categoryL2: p.categoryL2,
      currentStock: totalStock,
      safetyStock: p.safetyStock,
      originalPrice: p.originalPrice,
      discountPrice: p.discountPrice,
      costPrice: p.costPrice,
      unit: p.unit,
      weight: p.weight,
      beijingId: p.beijingId,
      warehouseStocks: p.warehouseStocks.map((ws) => ({
        warehouseName: ws.warehouse.name,
        stock: ws.stock,
        unattendedStock: ws.unattendedStock,
        damagedStock: ws.damagedStock,
        shelfId: ws.shelfId,
      })),
      platformStatus,
    };
  });

  const categories = await prisma.product.findMany({
    select: { categoryL1: true },
    distinct: ["categoryL1"],
  });

  return NextResponse.json({
    items,
    totalCount,
    lowStockCount,
    syncFailures,
    categories: categories.map((c) => c.categoryL1),
  });
}

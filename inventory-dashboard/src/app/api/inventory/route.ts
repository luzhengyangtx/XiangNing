import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";
  const warehouseId = searchParams.get("warehouseId");
  const sortCol = searchParams.get("sortCol");
  const sortDir = searchParams.get("sortDir") || "asc";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [{ title: { contains: search } }, { sku: { contains: search } }];
  }
  if (category !== "all") where.categoryL1 = category;

  const orderBy: Record<string, string> = {};
  const allowed = ["title", "sku", "originalPrice", "discountPrice", "categoryL1", "createdAt"];
  if (sortCol && allowed.includes(sortCol)) orderBy[sortCol] = sortDir;
  else orderBy["createdAt"] = "desc";

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      warehouseStocks: { include: { warehouse: true } },
      platformLinks: { include: { platform: { select: { name: true, code: true } } } },
    },
  });

  const totalCount = await prisma.product.count({ where });
  const allProducts = await prisma.product.findMany({
    include: { warehouseStocks: true },
  });

  // Low stock: compare per-warehouse or aggregate
  const lowStockCount = allProducts.filter((p) => {
    const stocks = warehouseId
      ? p.warehouseStocks.filter((ws) => ws.warehouseId === warehouseId)
      : p.warehouseStocks;
    const total = stocks.reduce((s, ws) => s + ws.stock, 0);
    return total < p.safetyStock;
  }).length;

  // Today's sync failures
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const syncFailures = await prisma.syncTask.count({
    where: { status: { in: ["failed", "partial_fail"] }, createdAt: { gte: today } },
  });

  // Transform
  const items = products.map((p) => {
    const stocks = warehouseId
      ? p.warehouseStocks.filter((ws) => ws.warehouseId === warehouseId)
      : p.warehouseStocks;
    const totalStock = stocks.reduce((s, ws) => s + ws.stock, 0);
    const totalUnattended = stocks.reduce((s, ws) => s + ws.unattendedStock, 0);

    const platformStatus: Record<string, { status: string; errorMessage?: string | null }> = {};
    for (const link of p.platformLinks) {
      platformStatus[link.platform.code] = {
        status: link.syncStatus,
        errorMessage: link.syncStatus === "failed" ? (p as { platformLinks?: { errorMessage?: string }[] }).platformLinks?.[0]?.errorMessage || null : null,
      };
    }

    return {
      id: p.id,
      title: p.title,
      sku: p.sku,
      categoryL1: p.categoryL1,
      categoryL2: p.categoryL2,
      currentStock: totalStock,
      unattendedStock: totalUnattended,
      safetyStock: p.safetyStock,
      originalPrice: p.originalPrice,
      discountPrice: p.discountPrice,
      costPrice: p.costPrice,
      unit: p.unit,
      weight: p.weight,
      beijingId: p.beijingId,
      warehouseStocks: stocks.map((ws) => ({
        warehouseId: ws.warehouse.id,
        warehouseName: ws.warehouse.name,
        warehouseCode: ws.warehouse.code,
        isUnattendedMode: ws.warehouse.isUnattendedMode,
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

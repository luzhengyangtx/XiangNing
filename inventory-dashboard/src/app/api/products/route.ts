import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const createSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  onlineSpec: z.string().optional(),
  beijingId: z.string().optional(),
  originalPrice: z.number().min(0).default(0),
  discountPrice: z.number().min(0).default(0),
  costPrice: z.number().min(0).default(0),
  weight: z.number().optional(),
  categoryL1: z.string().min(1),
  categoryL2: z.string().optional(),
  mainImage: z.string().optional(),
  shippingSampleImage: z.string().optional(),
  link: z.string().optional(),
  purchaseSpec: z.string().optional(),
  jdSku: z.string().optional(),
  packagingMaterial: z.string().optional(),
  packagingPrice: z.number().min(0).default(0),
  description: z.string().optional(),
  unit: z.string().default("个"),
  safetyStock: z.number().int().min(0).default(0),
  warehouseStocks: z.array(z.object({
    warehouseId: z.string(),
    stock: z.number().int().min(0).default(0),
    unattendedStock: z.number().int().min(0).default(0),
    shelfId: z.string().optional(),
    damagedStock: z.number().int().min(0).default(0),
  })).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [{ title: { contains: search } }, { sku: { contains: search } }];
  }
  if (category !== "all") {
    where.categoryL1 = category;
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { warehouseStocks: { include: { warehouse: true } } },
  });

  const result = products.map((p) => ({
    ...p,
    currentStock: p.warehouseStocks.reduce((s, ws) => s + ws.stock, 0),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数不正确", details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) {
      return NextResponse.json({ error: "SKU 已存在" }, { status: 409 });
    }

    const { warehouseStocks, ...prodData } = parsed.data;

    const product = await prisma.product.create({
      data: {
        ...prodData,
        warehouseStocks: warehouseStocks ? {
          create: warehouseStocks,
        } : undefined,
      },
    });

    // Auto-create warehouse stocks for all warehouses if not specified
    if (!warehouseStocks || warehouseStocks.length === 0) {
      const warehouses = await prisma.warehouse.findMany();
      await prisma.warehouseInventory.createMany({
        data: warehouses.map((w) => ({
          warehouseId: w.id,
          productId: product.id,
          stock: 0,
        })),
      });
    }

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "create_product",
        entityType: "product",
        entityId: product.id,
        detail: JSON.stringify({ title: product.title, sku: product.sku }),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

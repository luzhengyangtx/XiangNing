import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  category: z.string().min(1),
  price: z.number().positive(),
  unit: z.string().default("个"),
  description: z.string().optional(),
  safetyStock: z.number().int().min(0).default(0),
  currentStock: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";

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

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(products);
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

    const product = await prisma.product.create({ data: parsed.data });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "create_product",
        entityType: "product",
        entityId: product.id,
        detail: JSON.stringify({ name: product.name, sku: product.sku }),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

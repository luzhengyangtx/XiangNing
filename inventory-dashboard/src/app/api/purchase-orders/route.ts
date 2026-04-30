import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const warehouseId = searchParams.get("warehouseId");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (warehouseId) where.warehouseId = warehouseId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      warehouse: { select: { name: true, code: true } },
      items: { include: { product: { select: { title: true, sku: true, costPrice: true, link: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(orders);
}

const createSchema = z.object({
  warehouseId: z.string(),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
  })),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = await request.json();
    const p = createSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "参数不正确" }, { status: 400 });

    const { warehouseId, note, items } = p.data;
    const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) return NextResponse.json({ error: "仓库不存在" }, { status: 404 });

    // Auto-fill SKU, cost, link from products
    const orderItems = [];
    for (const item of items) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!prod) return NextResponse.json({ error: `商品 ${item.productId} 不存在` }, { status: 404 });
      orderItems.push({
        productId: prod.id,
        sku: prod.sku,
        quantity: item.quantity,
        costPrice: prod.costPrice,
        link: prod.link,
      });
    }

    const order = await prisma.purchaseOrder.create({
      data: {
        warehouseId,
        note,
        items: { create: orderItems },
      },
      include: {
        warehouse: { select: { name: true } },
        items: { include: { product: { select: { title: true, sku: true } } } },
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "create_product",
        entityType: "purchase_order",
        entityId: order.id,
        detail: JSON.stringify({
          warehouse: wh.name,
          itemCount: items.length,
          totalQty: items.reduce((s, i) => s + i.quantity, 0),
        }),
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

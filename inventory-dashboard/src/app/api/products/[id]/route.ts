import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }

    // Handle warehouse stock updates separately
    const { warehouseStocks, ...prodData } = body;

    const updated = await prisma.product.update({
      where: { id },
      data: prodData,
    });

    if (warehouseStocks && Array.isArray(warehouseStocks)) {
      for (const ws of warehouseStocks) {
        await prisma.warehouseInventory.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: ws.warehouseId,
              productId: id,
            },
          },
          create: ws,
          update: ws,
        });
      }
    }

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "update_product",
        entityType: "product",
        entityId: id,
        detail: JSON.stringify({ before: { title: existing.title }, after: { ...prodData } }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "商品不存在" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "delete_product",
        entityType: "product",
        entityId: id,
        detail: JSON.stringify({ title: product.title, sku: product.sku }),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

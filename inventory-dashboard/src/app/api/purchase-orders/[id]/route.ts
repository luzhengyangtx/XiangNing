import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      warehouse: { select: { name: true, code: true } },
      items: { include: { product: { select: { title: true, sku: true, costPrice: true, link: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: "进货单不存在" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true, warehouse: true },
    });
    if (!existing) return NextResponse.json({ error: "进货单不存在" }, { status: 404 });

    // Handle arrival: auto-add stock to warehouse
    if (body.status === "arrived" && existing.status === "pending") {
      const damageDetail = body.damageDetail ? (typeof body.damageDetail === "string" ? body.damageDetail : JSON.stringify(body.damageDetail)) : null;

      const result = await prisma.$transaction(async (tx) => {
        // Parse damage map
        const damageMap: Record<string, number> = {};
        if (body.damageDetail && Array.isArray(body.damageDetail)) {
          for (const d of body.damageDetail) {
            damageMap[d.productId || d.itemId] = Number(d.quantity) || 0;
          }
        }

        for (const item of existing.items) {
          const damageQty = damageMap[item.id] || damageMap[item.productId] || 0;
          const addQty = Math.max(0, item.quantity - damageQty);

          if (addQty > 0) {
            // Upsert warehouse inventory
            const existingInv = await tx.warehouseInventory.findUnique({
              where: { warehouseId_productId: { warehouseId: existing.warehouseId, productId: item.productId } },
            });

            if (existingInv) {
              await tx.warehouseInventory.update({
                where: { id: existingInv.id },
                data: {
                  stock: existingInv.stock + addQty,
                  unattendedStock: existing.warehouse.isUnattendedMode
                    ? existingInv.unattendedStock + addQty
                    : existingInv.unattendedStock,
                },
              });
            } else {
              await tx.warehouseInventory.create({
                data: {
                  warehouseId: existing.warehouseId,
                  productId: item.productId,
                  stock: addQty,
                  unattendedStock: existing.warehouse.isUnattendedMode ? addQty : 0,
                },
              });
            }

            await tx.operationLog.create({
              data: {
                userId: user.userId,
                action: "stock_in",
                entityType: "inventory",
                entityId: item.productId,
                detail: JSON.stringify({
                  productName: "",
                  warehouse: existing.warehouse.name,
                  delta: addQty,
                  reason: `进货单 #${existing.id.slice(-6)} 到货`,
                  damage: damageQty,
                }),
              },
            });
          }
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: "arrived",
            arrivedAt: new Date(),
            damageDetail,
            note: body.note ?? existing.note,
          },
        });
      });

      return NextResponse.json(result);
    }

    // Other status updates
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: body.status ?? existing.status,
        note: body.note ?? existing.note,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "进货单不存在" }, { status: 404 });
    if (order.status !== "pending") {
      return NextResponse.json({ error: "仅待收货状态的进货单可删除" }, { status: 400 });
    }

    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

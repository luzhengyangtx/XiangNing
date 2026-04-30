import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const batchSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    warehouseId: z.string(),
    delta: z.number().int(),
    isUnattended: z.boolean().optional(),
  })),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = await request.json();
    const p = batchSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "参数不正确" }, { status: 400 });

    const { items, reason } = p.data;
    const results: { productId: string; currentStock: number; unattendedStock: number; error?: string }[] = [];

    for (const { productId, warehouseId, delta, isUnattended } of items) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const inv = await tx.warehouseInventory.findUnique({
            where: { warehouseId_productId: { warehouseId, productId } },
            include: { warehouse: true, product: true },
          });
          if (!inv) throw new Error("无库存记录");

          if (isUnattended) {
            const newU = inv.unattendedStock + delta;
            if (newU < 0) throw new Error("无人值守库存不足");
            if (newU > inv.stock) throw new Error("无人值守库存不能超过总库存");
            await tx.warehouseInventory.update({
              where: { id: inv.id },
              data: { unattendedStock: newU, stock: Math.max(0, inv.stock + delta) },
            });
          } else {
            const newStock = inv.stock + delta;
            if (newStock < 0) throw new Error("库存不足");
            await tx.warehouseInventory.update({
              where: { id: inv.id },
              data: { stock: newStock, unattendedStock: Math.min(inv.unattendedStock, newStock) },
            });
          }

          const updated = await tx.warehouseInventory.findUnique({ where: { id: inv.id } });
          await tx.operationLog.create({
            data: {
              userId: user.userId,
              action: delta > 0 ? "stock_in" : "stock_out",
              entityType: "inventory",
              entityId: productId,
              detail: JSON.stringify({
                productName: inv.product.title, warehouse: inv.warehouse.name,
                delta, reason: reason || "批量调整", stock: updated!.stock, unattendedStock: updated!.unattendedStock,
              }),
            },
          });
          return { stock: updated!.stock, unattendedStock: updated!.unattendedStock };
        });
        results.push({ productId, currentStock: result.stock, unattendedStock: result.unattendedStock });
      } catch (e) {
        results.push({ productId, currentStock: 0, unattendedStock: 0, error: e instanceof Error ? e.message : "失败" });
      }
    }
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 });
  }
}

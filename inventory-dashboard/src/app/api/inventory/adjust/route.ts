import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const adjustSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  delta: z.number().int(),
  isUnattended: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = await request.json();
    const p = adjustSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "参数不正确" }, { status: 400 });

    const { productId, warehouseId, delta, isUnattended, reason } = p.data;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("商品不存在");

      const inv = await tx.warehouseInventory.findUnique({
        where: { warehouseId_productId: { warehouseId, productId } },
        include: { warehouse: true },
      });
      if (!inv) throw new Error("该仓库无此商品库存");

      if (isUnattended) {
        const newUnattended = inv.unattendedStock + delta;
        if (newUnattended < 0) throw new Error("无人值守库存不足");
        if (newUnattended > inv.stock) throw new Error("无人值守库存不能超过总库存");

        await tx.warehouseInventory.update({
          where: { id: inv.id },
          data: { unattendedStock: newUnattended },
        });

        // Also adjust total stock when unattended changes (linked deduction)
        await tx.warehouseInventory.update({
          where: { id: inv.id },
          data: { stock: Math.max(0, inv.stock + delta) },
        });
      } else {
        const newStock = inv.stock + delta;
        if (newStock < 0) throw new Error("库存不足，无法扣减");

        await tx.warehouseInventory.update({
          where: { id: inv.id },
          data: { stock: newStock },
        });

        // If unattended exists and would exceed stock, clamp it
        if (inv.unattendedStock > newStock) {
          await tx.warehouseInventory.update({
            where: { id: inv.id },
            data: { unattendedStock: newStock },
          });
        }
      }

      const updated = await tx.warehouseInventory.findUnique({
        where: { id: inv.id },
      });

      await tx.operationLog.create({
        data: {
          userId: user.userId,
          action: delta > 0 ? "stock_in" : "stock_out",
          entityType: "inventory",
          entityId: productId,
          detail: JSON.stringify({
            productName: product.title,
            warehouse: inv.warehouse.name,
            mode: isUnattended ? "unattended" : "normal",
            delta,
            reason: reason || (delta > 0 ? "手动加库存" : "手动减库存"),
            stock: updated!.stock,
            unattendedStock: updated!.unattendedStock,
          }),
        },
      });

      return { productId, currentStock: updated!.stock, unattendedStock: updated!.unattendedStock };
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "操作失败";
    const status = msg.includes("库存不足") ? 422 : msg.includes("不存在") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

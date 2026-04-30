import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const adjustSchema = z.object({
  productId: z.string(),
  delta: z.number().int(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数不正确" }, { status: 400 });
    }

    const { productId, delta, reason } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { warehouseStocks: { take: 1 } },
      });
      if (!product) throw new Error("商品不存在");

      const totalStock = product.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);
      const newTotal = totalStock + delta;
      if (newTotal < 0) throw new Error("库存不足，无法扣减");

      // Update first warehouse stock (国贸)
      if (product.warehouseStocks.length > 0) {
        const ws = product.warehouseStocks[0];
        await tx.warehouseInventory.update({
          where: { id: ws.id },
          data: { stock: Math.max(0, ws.stock + delta) },
        });
      }

      // Recalculate total
      const updatedProduct = await tx.product.findUnique({
        where: { id: productId },
        include: { warehouseStocks: true },
      });
      const newTotalActual = updatedProduct!.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);

      await tx.operationLog.create({
        data: {
          userId: user.userId,
          action: delta > 0 ? "stock_in" : "stock_out",
          entityType: "product",
          entityId: productId,
          detail: JSON.stringify({
            productName: product.title,
            delta,
            reason: reason || (delta > 0 ? "手动加库存" : "手动减库存"),
            from: totalStock,
            to: newTotalActual,
          }),
        },
      });

      return { productId, currentStock: newTotalActual };
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败";
    const status = message === "库存不足，无法扣减" ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

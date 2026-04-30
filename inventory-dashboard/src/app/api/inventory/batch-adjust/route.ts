import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const batchSchema = z.object({
  items: z.array(z.object({ productId: z.string(), delta: z.number().int() })),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数不正确" }, { status: 400 });
    }

    const { items, reason } = parsed.data;
    const results: { productId: string; currentStock: number; error?: string }[] = [];

    for (const { productId, delta } of items) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: productId },
            include: { warehouseStocks: { take: 1 } },
          });
          if (!product) throw new Error("商品不存在");

          const totalStock = product.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);
          const newTotal = totalStock + delta;
          if (newTotal < 0) throw new Error("库存不足");

          if (product.warehouseStocks.length > 0) {
            const ws = product.warehouseStocks[0];
            await tx.warehouseInventory.update({
              where: { id: ws.id },
              data: { stock: Math.max(0, ws.stock + delta) },
            });
          }

          const updated = await tx.product.findUnique({
            where: { id: productId },
            include: { warehouseStocks: true },
          });
          const newActual = updated!.warehouseStocks.reduce((s, ws) => s + ws.stock, 0);

          await tx.operationLog.create({
            data: {
              userId: user.userId,
              action: delta > 0 ? "stock_in" : "stock_out",
              entityType: "product",
              entityId: productId,
              detail: JSON.stringify({
                productName: product.title, delta,
                reason: reason || "批量调整",
                from: totalStock, to: newActual,
              }),
            },
          });

          return newActual;
        });
        results.push({ productId, currentStock: result });
      } catch (e) {
        results.push({ productId, currentStock: 0, error: e instanceof Error ? e.message : "失败" });
      }
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "批量操作失败" }, { status: 500 });
  }
}

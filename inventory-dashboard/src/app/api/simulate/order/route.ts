import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const meituan = await prisma.platform.findUnique({ where: { code: "meituan" } });
    if (!meituan || meituan.status !== "connected") {
      return NextResponse.json({ error: "美团平台未连接" }, { status: 400 });
    }

    const products = await prisma.product.findMany({
      include: { warehouseStocks: { take: 1 } },
    });
    const withStock = products.filter((p) =>
      p.warehouseStocks.reduce((s, ws) => s + ws.stock, 0) > 0
    );

    if (withStock.length === 0) {
      return NextResponse.json({ message: "没有可扣减的商品" });
    }

    const randomCount = Math.min(Math.floor(Math.random() * 2) + 1, withStock.length);
    const selected = withStock.sort(() => Math.random() - 0.5).slice(0, randomCount);

    const results: { productId: string; name: string; currentStock: number }[] = [];

    for (const product of selected) {
      const result = await prisma.$transaction(async (tx) => {
        const p = await tx.product.findUnique({
          where: { id: product.id },
          include: { warehouseStocks: { take: 1 } },
        });
        if (!p || p.warehouseStocks.length === 0) return null;

        const ws = p.warehouseStocks[0];
        if (ws.stock <= 0) return null;

        const newStock = ws.stock - 1;
        await tx.warehouseInventory.update({
          where: { id: ws.id },
          data: { stock: newStock },
        });

        const totalAfter = await tx.product.findUnique({
          where: { id: product.id },
          include: { warehouseStocks: true },
        });
        const newTotal = totalAfter!.warehouseStocks.reduce((s, w) => s + w.stock, 0);

        await tx.operationLog.create({
          data: {
            action: "stock_out",
            entityType: "product",
            entityId: product.id,
            detail: JSON.stringify({
              productName: p.title, delta: -1,
              reason: `美团订单 #MT${Date.now().toString(36).toUpperCase()} 自动扣减`,
              from: ws.stock + 1, to: newTotal,
            }),
          },
        });

        return { productId: product.id, name: p.title, currentStock: newTotal };
      });

      if (result) results.push(result);
    }

    // Create sync task
    await prisma.syncTask.create({
      data: {
        platformId: meituan.id,
        type: "order_decrease",
        status: "success",
        totalCount: results.length,
        failCount: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        items: {
          create: results.map((r) => ({ productId: r.productId, status: "success" })),
        },
      },
    });

    return NextResponse.json({
      message: `模拟美团订单: 扣减 ${results.length} 个商品`,
      orderId: `MT${Date.now().toString(36).toUpperCase()}`,
      results,
    });
  } catch {
    return NextResponse.json({ error: "模拟订单失败" }, { status: 500 });
  }
}

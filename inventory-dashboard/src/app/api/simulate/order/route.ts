import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simulate receiving a Meituan order -> auto decrease inventory -> trigger sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "请提供商品ID列表" }, { status: 400 });
    }

    const meituan = await prisma.platform.findUnique({ where: { code: "meituan" } });
    if (!meituan || meituan.status !== "connected") {
      return NextResponse.json({ error: "美团平台未连接" }, { status: 400 });
    }

    const results = [];

    for (const productId of productIds) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("商品不存在");

          const newStock = Math.max(0, product.currentStock - 1);
          const updated = await tx.product.update({
            where: { id: productId },
            data: { currentStock: newStock },
          });

          // Create operation log
          await tx.operationLog.create({
            data: {
              action: "stock_out",
              entityType: "product",
              entityId: productId,
              detail: JSON.stringify({
                productName: product.name,
                delta: -1,
                reason: `美团订单 #MT${Date.now().toString(36).toUpperCase()} 自动扣减`,
                from: product.currentStock,
                to: newStock,
              }),
            },
          });

          return updated;
        });
        results.push({ productId, currentStock: result.currentStock, success: true });
      } catch (e) {
        results.push({ productId, currentStock: 0, success: false, error: e instanceof Error ? e.message : "失败" });
      }
    }

    // Create sync task to push updated inventory to platform
    const failCount = results.filter((r) => !r.success).length;
    await prisma.syncTask.create({
      data: {
        platformId: meituan.id,
        type: "order_decrease",
        status: failCount === 0 ? "success" : "partial_fail",
        totalCount: productIds.length,
        failCount,
        startedAt: new Date(),
        finishedAt: new Date(),
        items: {
          create: results.map((r) => ({
            productId: r.productId,
            status: r.success ? "success" : "failed",
            errorCode: r.success ? null : "ORDER_PROCESS_ERROR",
            errorMessage: r.success ? null : r.error,
          })),
        },
      },
    });

    return NextResponse.json({
      message: `模拟订单处理完成: ${results.filter(r => r.success).length}/${productIds.length} 成功`,
      results,
    });
  } catch {
    return NextResponse.json({ error: "模拟订单失败" }, { status: 500 });
  }
}

// Also support GET to simulate a random order
export async function GET() {
  try {
    const meituan = await prisma.platform.findUnique({ where: { code: "meituan" } });
    if (!meituan || meituan.status !== "connected") {
      return NextResponse.json({ error: "美团平台未连接" }, { status: 400 });
    }

    // Pick a random product with stock > 0
    const products = await prisma.product.findMany({
      where: { currentStock: { gt: 0 } },
      take: 5,
    });

    if (products.length === 0) {
      return NextResponse.json({ message: "没有可扣减的商品" });
    }

    const randomCount = Math.min(Math.floor(Math.random() * 3) + 1, products.length);
    const selected = products.sort(() => Math.random() - 0.5).slice(0, randomCount);

    const results = [];
    for (const product of selected) {
      const result = await prisma.$transaction(async (tx) => {
        const p = await tx.product.findUnique({ where: { id: product.id } });
        if (!p || p.currentStock <= 0) return null;

        const newStock = p.currentStock - 1;
        const updated = await tx.product.update({
          where: { id: product.id },
          data: { currentStock: newStock },
        });

        await tx.operationLog.create({
          data: {
            action: "stock_out",
            entityType: "product",
            entityId: product.id,
            detail: JSON.stringify({
              productName: p.name,
              delta: -1,
              reason: `美团订单 #MT${Date.now().toString(36).toUpperCase()} 自动扣减`,
              from: p.currentStock,
              to: newStock,
            }),
          },
        });

        return updated;
      });

      if (result) {
        results.push({ productId: product.id, name: product.name, currentStock: result.currentStock, success: true });
      }
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
          create: results.map((r) => ({
            productId: r.productId,
            status: "success",
          })),
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

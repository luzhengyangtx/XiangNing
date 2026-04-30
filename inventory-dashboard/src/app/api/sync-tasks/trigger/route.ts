import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { platformId } = await request.json();

    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) {
      return NextResponse.json({ error: "平台不存在" }, { status: 404 });
    }

    if (platform.status !== "connected") {
      return NextResponse.json({ error: "平台未连接" }, { status: 400 });
    }

    // Get products linked to this platform
    const links = await prisma.productPlatformLink.findMany({
      where: { platformId },
      include: { product: true },
    });

    // Create sync task
    const items = links.map((link) => {
      const willFail = Math.random() < 0.15; // 15% simulated failure rate
      return {
        productId: link.productId,
        status: willFail ? "failed" : "success",
        errorCode: willFail ? ["IMG_LINK_INVALID", "SKU_DUPLICATE", "PRICE_INVALID", "NETWORK_TIMEOUT"][Math.floor(Math.random() * 4)] : null,
        errorMessage: willFail ? ["商品主图链接失效，请重新上传", "SKU已存在于平台，请检查映射", "价格超出平台允许范围", "网络请求超时"][Math.floor(Math.random() * 4)] : null,
      };
    });

    const failCount = items.filter((i) => i.status === "failed").length;
    const task = await prisma.syncTask.create({
      data: {
        platformId,
        type: "push_inventory",
        status: failCount === 0 ? "success" : failCount === items.length ? "failed" : "partial_fail",
        totalCount: items.length,
        failCount,
        startedAt: new Date(),
        finishedAt: new Date(),
        items: { create: items },
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "sync_push",
        entityType: "sync_task",
        entityId: task.id,
        detail: JSON.stringify({
          type: "push_inventory",
          platform: platform.name,
          result: task.status,
          failCount,
        }),
      },
    });

    // Update link sync statuses
    for (const link of links) {
      const item = items.find((i) => i.productId === link.productId);
      await prisma.productPlatformLink.update({
        where: { id: link.id },
        data: {
          syncStatus: item?.status === "failed" ? "failed" : "synced",
          lastSyncAt: new Date(),
        },
      });
    }

    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "触发同步失败" }, { status: 500 });
  }
}

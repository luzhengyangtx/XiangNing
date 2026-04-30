import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { productId, platformId, status } = await request.json();
    if (!productId || !platformId || !["on", "off"].includes(status)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const existing = await prisma.productPlatformLink.findUnique({
      where: { productId_platformId: { productId, platformId } },
    });

    if (existing) {
      await prisma.productPlatformLink.update({
        where: { id: existing.id },
        data: { shelvesStatus: status },
      });
    } else {
      await prisma.productPlatformLink.create({
        data: { productId, platformId, shelvesStatus: status, syncStatus: "pending" },
      });
    }

    if (status === "on") {
      await prisma.operationLog.create({
        data: { action: "shelves_on", entityType: "product", entityId: productId, detail: `上架到${platformId}` },
      });
    }

    return NextResponse.json({ ok: true, shelvesStatus: status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "操作失败" }, { status: 500 });
  }
}

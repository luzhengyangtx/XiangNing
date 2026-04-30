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

    const updated = await prisma.platform.update({
      where: { id: platformId },
      data: { status: "disconnected", authData: null },
    });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "platform_unbind",
        entityType: "platform",
        entityId: platformId,
        detail: JSON.stringify({ platform: platform.name }),
      },
    });

    // Remove platform-product links
    await prisma.productPlatformLink.deleteMany({ where: { platformId } });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "解绑失败" }, { status: 500 });
  }
}

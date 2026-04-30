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

    // Simulate OAuth flow - generate mock token
    const authData = JSON.stringify({
      token: `mock_token_${platform.code}_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const updated = await prisma.platform.update({
      where: { id: platformId },
      data: { status: "connected", authData },
    });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "platform_bind",
        entityType: "platform",
        entityId: platformId,
        detail: JSON.stringify({ platform: platform.name, authType: platform.authType }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "授权失败" }, { status: 500 });
  }
}

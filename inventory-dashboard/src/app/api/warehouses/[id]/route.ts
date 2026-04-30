import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const wh = await prisma.warehouse.findUnique({ where: { id } });
    if (!wh) return NextResponse.json({ error: "仓库不存在" }, { status: 404 });

    const updated = await prisma.warehouse.update({
      where: { id },
      data: { isUnattendedMode: body.isUnattendedMode ?? wh.isUnattendedMode },
    });

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "update_product",
        entityType: "warehouse",
        entityId: id,
        detail: JSON.stringify({
          warehouse: wh.name,
          isUnattendedMode: updated.isUnattendedMode,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

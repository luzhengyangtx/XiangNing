import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const where: Record<string, unknown> = {};
  if (entityType) {
    where.entityType = entityType;
  }

  const logs = await prisma.operationLog.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}

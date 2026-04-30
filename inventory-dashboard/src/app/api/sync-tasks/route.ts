import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tasks = await prisma.syncTask.findMany({
    include: {
      platform: { select: { name: true, code: true } },
      items: {
        include: {
          product: { select: { title: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(tasks);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    include: { inventories: { include: { product: { select: { title: true, sku: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(warehouses);
}

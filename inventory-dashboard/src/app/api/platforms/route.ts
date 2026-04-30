import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const platforms = await prisma.platform.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(platforms);
}

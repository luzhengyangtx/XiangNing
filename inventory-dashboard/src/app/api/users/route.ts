import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(["owner", "staff"]),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "owner") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const currentUser = await getAuthUser();
  if (!currentUser || currentUser.role !== "owner") {
    return NextResponse.json({ error: "仅店长可创建用户" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "参数不正确" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "邮箱已存在" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(parsed.data.password, 10);
    const newUser = await prisma.user.create({
      data: { ...parsed.data, password: hashed },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    await prisma.operationLog.create({
      data: {
        userId: currentUser.userId,
        action: "create_product",
        entityType: "user",
        entityId: newUser.id,
        detail: JSON.stringify({ name: newUser.name, email: newUser.email, role: newUser.role }),
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

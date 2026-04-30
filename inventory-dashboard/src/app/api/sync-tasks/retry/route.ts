import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { taskId, itemId } = await request.json();

    if (itemId) {
      // Retry single item
      const item = await prisma.syncTaskItem.findUnique({ where: { id: itemId } });
      if (!item) {
        return NextResponse.json({ error: "同步项不存在" }, { status: 404 });
      }

      // Simulate success
      const updated = await prisma.syncTaskItem.update({
        where: { id: itemId },
        data: { status: "success", errorCode: null, errorMessage: null },
      });

      // Update task fail count
      const task = await prisma.syncTask.findUnique({
        where: { id: taskId },
        include: { items: true },
      });
      if (task) {
        const remainingFails = task.items.filter((i) => i.status === "failed").length;
        const newStatus = remainingFails === 0 ? "success" : "partial_fail";
        await prisma.syncTask.update({
          where: { id: taskId },
          data: { status: newStatus, failCount: remainingFails },
        });
      }

      return NextResponse.json(updated);
    }

    // Retry all failed items in a task
    const task = await prisma.syncTask.findUnique({
      where: { id: taskId },
      include: { items: true },
    });
    if (!task) {
      return NextResponse.json({ error: "同步任务不存在" }, { status: 404 });
    }

    const failedItems = task.items.filter((i) => i.status === "failed");
    for (const item of failedItems) {
      await prisma.syncTaskItem.update({
        where: { id: item.id },
        data: { status: Math.random() > 0.3 ? "success" : "failed" }, // 70% success rate
      });
    }

    const updatedTask = await prisma.syncTask.findUnique({
      where: { id: taskId },
      include: { items: true },
    });
    if (updatedTask) {
      const remainingFails = updatedTask.items.filter((i) => i.status === "failed").length;
      const newStatus = remainingFails === 0 ? "success" : "partial_fail";
      await prisma.syncTask.update({
        where: { id: taskId },
        data: { status: newStatus, failCount: remainingFails },
      });
    }

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action: "sync_push",
        entityType: "sync_task",
        entityId: taskId,
        detail: JSON.stringify({ type: "retry", failCount: failedItems.length }),
      },
    });

    return NextResponse.json({ success: true, retried: failedItems.length });
  } catch {
    return NextResponse.json({ error: "重试失败" }, { status: 500 });
  }
}

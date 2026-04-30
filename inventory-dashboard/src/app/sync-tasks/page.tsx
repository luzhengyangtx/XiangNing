"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSyncTasks, retrySyncTask, triggerSync, fetchPlatforms } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, RefreshCw, RotateCw, ChevronDown, ChevronRight } from "lucide-react";

interface SyncTaskItem {
  id: string;
  productId: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  product: { name: string; sku: string };
}

interface SyncTask {
  id: string;
  platformId: string;
  type: string;
  status: string;
  totalCount: number;
  failCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  platform: { name: string; code: string };
  items: SyncTaskItem[];
}

const statusLabel: Record<string, string> = {
  pending: "等待中",
  running: "进行中",
  success: "成功",
  partial_fail: "部分失败",
  failed: "失败",
};

const statusColor: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  running: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  partial_fail: "bg-orange-100 text-orange-700",
  failed: "bg-red-100 text-red-700",
};

const typeLabel: Record<string, string> = {
  push_inventory: "推送库存",
  push_product: "推送商品",
  pull_product: "拉取商品",
  order_decrease: "订单减库存",
};

export default function SyncTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<{ id: string; name: string; status: string }[]>([]);
  const [triggering, setTriggering] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, platData] = await Promise.all([fetchSyncTasks(), fetchPlatforms()]);
      setTasks(taskData);
      setPlatforms(platData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadTasks();
  }, [authLoading, user, router, loadTasks]);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const handleRetry = async (taskId: string, itemId?: string) => {
    setRetrying(taskId + (itemId || ""));
    try {
      await retrySyncTask(taskId, itemId);
      toast.success("重试完成");
      loadTasks();
    } catch {
      toast.error("重试失败");
    } finally {
      setRetrying(null);
    }
  };

  const handleTriggerSync = async (platformId: string) => {
    setTriggering(true);
    try {
      await triggerSync(platformId);
      toast.success("同步任务已触发");
      loadTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "触发失败");
    } finally {
      setTriggering(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return null;

  const connectedPlatforms = platforms.filter((p) => p.status === "connected");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">同步任务</h1>
          <p className="text-sm text-muted-foreground">查看库存同步任务状态和失败详情</p>
        </div>
        <div className="flex gap-2">
          {connectedPlatforms.map((p) => (
            <Button key={p.id} size="sm" variant="outline" onClick={() => handleTriggerSync(p.id)} disabled={triggering}>
              <RotateCw className="mr-1 h-4 w-4" />
              同步到{p.name}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={loadTasks}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              暂无同步任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border">
                  <div className="flex items-center justify-between p-4">
                    <button
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => toggleExpand(task.id)}
                    >
                      {expanded.has(task.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {typeLabel[task.type] || task.type}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {task.platform.name}
                          </Badge>
                          <Badge variant="outline" className={statusColor[task.status]}>
                            {statusLabel[task.status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.totalCount} 项 · 失败 {task.failCount} 项
                          {task.startedAt && ` · ${new Date(task.startedAt).toLocaleString("zh-CN")}`}
                        </p>
                      </div>
                    </button>
                    {task.failCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(task.id)}
                        disabled={retrying === task.id}
                      >
                        {retrying === task.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-3 w-3" />
                        )}
                        全部重试
                      </Button>
                    )}
                  </div>

                  {/* Expanded items */}
                  {expanded.has(task.id) && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>商品</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>错误信息</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {task.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">{item.product.name}</TableCell>
                              <TableCell className="font-mono text-xs">{item.product.sku}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.status === "success"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }
                                >
                                  {item.status === "success" ? "成功" : "失败"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.status === "failed" && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-mono text-red-600">{item.errorCode}</p>
                                    <p className="text-xs text-muted-foreground">{item.errorMessage}</p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.status === "failed" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => handleRetry(task.id, item.id)}
                                    disabled={retrying === task.id + item.id}
                                  >
                                    {retrying === task.id + item.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "重试"
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

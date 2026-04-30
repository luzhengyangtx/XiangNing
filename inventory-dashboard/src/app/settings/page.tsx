"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchLogs } from "@/lib/api";
import { Loader2, FileText, User, Shield } from "lucide-react";

interface LogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const actionLabel: Record<string, string> = {
  create_product: "创建商品",
  update_product: "更新商品",
  delete_product: "删除商品",
  stock_in: "加库存",
  stock_out: "减库存",
  sync_push: "同步推送",
  sync_pull: "同步拉取",
  platform_bind: "平台授权",
  platform_unbind: "平台解绑",
};

const actionColor: Record<string, string> = {
  stock_in: "bg-green-100 text-green-700",
  stock_out: "bg-orange-100 text-orange-700",
  create_product: "bg-blue-100 text-blue-700",
  update_product: "bg-blue-100 text-blue-700",
  delete_product: "bg-red-100 text-red-700",
  sync_push: "bg-purple-100 text-purple-700",
  sync_pull: "bg-purple-100 text-purple-700",
  platform_bind: "bg-teal-100 text-teal-700",
  platform_unbind: "bg-gray-100 text-gray-500",
};

function formatDetail(detail: string | null): string {
  if (!detail) return "-";
  try {
    const obj = JSON.parse(detail);
    if (obj.delta !== undefined) {
      return `${obj.reason || ""} (${obj.delta > 0 ? "+" : ""}${obj.delta}, ${obj.from} → ${obj.to})`;
    }
    if (obj.platform) return `平台: ${obj.platform}`;
    if (obj.name) return `商品: ${obj.name}`;
    if (obj.type) return `${obj.type} - 平台: ${obj.platform} 结果: ${obj.result}`;
    return JSON.stringify(obj);
  } catch {
    return detail;
  }
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState("all");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        entityType: logFilter === "all" ? undefined : logFilter,
        limit: 100,
      });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [logFilter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadLogs();
  }, [authLoading, user, router, loadLogs]);

  if (authLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground">管理用户、权限和查看操作日志</p>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs" className="gap-1">
            <FileText className="h-4 w-4" />
            操作日志
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1">
            <User className="h-4 w-4" />
            个人信息
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>操作日志</CardTitle>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="product">商品操作</SelectItem>
                    <SelectItem value="inventory">库存操作</SelectItem>
                    <SelectItem value="platform">平台操作</SelectItem>
                    <SelectItem value="sync_task">同步任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                操作日志不可删除或修改，仅追加记录
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead className="w-[80px]">操作人</TableHead>
                    <TableHead className="w-[90px]">操作类型</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        暂无操作日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs tabular-nums">
                          {new Date(log.createdAt).toLocaleString("zh-CN")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.user?.name || "系统"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={actionColor[log.action] || "bg-gray-100 text-gray-500"}
                          >
                            {actionLabel[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                          {formatDetail(log.detail)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>个人信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge variant="outline" className="mt-1">
                    {user.role === "owner" ? "店长" : "店员"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-1 text-foreground">权限说明</p>
                {user.role === "owner" ? (
                  <ul className="list-disc pl-4 space-y-1">
                    <li>管理所有商品信息</li>
                    <li>操作库存（加/减/批量）</li>
                    <li>管理平台授权</li>
                    <li>查看同步任务和操作日志</li>
                    <li>管理用户权限</li>
                  </ul>
                ) : (
                  <ul className="list-disc pl-4 space-y-1">
                    <li>查看库存和商品信息</li>
                    <li>手动调整库存（需审批）</li>
                    <li>查看同步任务状态</li>
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchLogs, fetchUsers, createUser, deleteUser } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, FileText, User, Shield, Trash2 } from "lucide-react";

const actionLabel: Record<string, string> = {
  create_product: "创建商品", update_product: "更新商品", delete_product: "删除商品",
  stock_in: "加库存", stock_out: "减库存", sync_push: "同步推送", sync_pull: "同步拉取",
  platform_bind: "平台授权", platform_unbind: "平台解绑",
};

const actionColor: Record<string, string> = {
  stock_in: "bg-green-100 text-green-700", stock_out: "bg-orange-100 text-orange-700",
  create_product: "bg-blue-100 text-blue-700", update_product: "bg-blue-100 text-blue-700",
  delete_product: "bg-red-100 text-red-700", sync_push: "bg-purple-100 text-purple-700",
  platform_bind: "bg-teal-100 text-teal-700", platform_unbind: "bg-gray-100 text-gray-500",
};

function formatDetail(d: string | null): string {
  if (!d) return "-";
  try {
    const o = JSON.parse(d);
    if (o.delta !== undefined) return `${o.reason || ""} (${o.delta > 0 ? "+" : ""}${o.delta}, ${o.from}→${o.to})`;
    if (o.platform) return `平台: ${o.platform}`;
    if (o.title) return `商品: ${o.title}`;
    return JSON.stringify(o);
  } catch { return d; }
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState("all");
  const [userOpen, setUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "staff" });
  const [saving, setSaving] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try { setLogs(await fetchLogs({ entityType: logFilter === "all" ? undefined : logFilter, limit: 100 })); }
    finally { setLoading(false); }
  }, [logFilter]);

  const loadUsers = useCallback(async () => {
    try { setUsers(await fetchUsers()); } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) { loadLogs(); loadUsers(); }
  }, [authLoading, user, router, loadLogs, loadUsers]);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) { toast.error("请填写完整"); return; }
    setSaving(true);
    try { await createUser(newUser); toast.success("用户已创建"); setUserOpen(false); setNewUser({ name: "", email: "", password: "", role: "staff" }); loadUsers(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "创建失败"); }
    finally { setSaving(false); }
  };

  const handleDeleteUser = async (id: string) => {
    try { await deleteUser(id); toast.success("已删除"); loadUsers(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "删除失败"); }
  };

  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  const isOwner = user.role === "owner";

  return (
    <div className="space-y-6 p-6">
      <div><h1 className="text-2xl font-bold">系统设置</h1><p className="text-sm text-muted-foreground">用户管理 · 操作日志 · 个人信息</p></div>

      <Tabs defaultValue={isOwner ? "users" : "profile"}>
        <TabsList>
          {isOwner && <TabsTrigger value="users"><Shield className="h-4 w-4 mr-1" />用户管理</TabsTrigger>}
          <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-1" />操作日志</TabsTrigger>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" />个人信息</TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        {isOwner && (
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>用户列表</CardTitle>
                <Button size="sm" onClick={() => setUserOpen(true)}><User className="h-4 w-4 mr-1" />添加用户</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>姓名</TableHead><TableHead>邮箱</TableHead><TableHead>角色</TableHead><TableHead>创建时间</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id as string}>
                        <TableCell className="font-medium">{u.name as string}</TableCell>
                        <TableCell className="text-sm">{u.email as string}</TableCell>
                        <TableCell><Badge variant={u.role === "owner" ? "default" : "secondary"}>{(u.role as string) === "owner" ? "店长" : "店员"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt as string).toLocaleDateString("zh-CN")}</TableCell>
                        <TableCell>
                          {u.id !== user.id && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteUser(u.id as string)}><Trash2 className="h-3 w-3" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Logs Tab ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>操作日志</CardTitle>
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="product">商品</SelectItem>
                  <SelectItem value="inventory">库存</SelectItem>
                  <SelectItem value="platform">平台</SelectItem>
                  <SelectItem value="sync_task">同步</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">操作日志仅追加，不可删除或修改</p>
              <Table>
                <TableHeader><TableRow><TableHead className="w-[150px]">时间</TableHead><TableHead className="w-[80px]">操作人</TableHead><TableHead className="w-[90px]">操作</TableHead><TableHead>详情</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                    : logs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">暂无日志</TableCell></TableRow>
                      : logs.map((l) => (
                        <TableRow key={l.id as string}>
                          <TableCell className="text-xs">{new Date(l.createdAt as string).toLocaleString("zh-CN")}</TableCell>
                          <TableCell className="text-xs">{(l.user as { name?: string })?.name || "系统"}</TableCell>
                          <TableCell><Badge variant="outline" className={actionColor[l.action as string] || ""}>{actionLabel[l.action as string] || (l.action as string)}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md truncate">{formatDetail(l.detail as string)}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>个人信息</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Shield className="h-8 w-8 text-primary" /></div>
                <div><p className="text-lg font-medium">{user.name}</p><p className="text-sm text-muted-foreground">{user.email}</p><Badge variant="outline" className="mt-1">{user.role === "owner" ? "店长" : "店员"}</Badge></div>
              </div>
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium mb-2">权限说明</p>
                {isOwner ? (
                  <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">商品管理</p><p className="text-xs">新增/编辑/删除商品</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">库存管理</p><p className="text-xs">加减库存/批量操作</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">平台管理</p><p className="text-xs">授权/解绑/同步</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">用户管理</p><p className="text-xs">添加/删除用户</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">操作日志</p><p className="text-xs">查看全部操作记录</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">系统配置</p><p className="text-xs">全局设置管理</p></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">商品查看</p><p className="text-xs">浏览商品信息</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">库存操作</p><p className="text-xs">加减库存（需审批）</p></div>
                    <div className="space-y-1"><p className="font-medium text-foreground text-xs">同步查看</p><p className="text-xs">查看同步任务状态</p></div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加用户</DialogTitle><DialogDescription>创建新的店员或店长账号</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4">
            <div><Label>姓名</Label><Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
            <div><Label>邮箱</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
            <div><Label>密码</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
            <div><Label>角色</Label><Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="staff">店员</SelectItem><SelectItem value="owner">店长</SelectItem></SelectContent>
            </Select></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserOpen(false)}>取消</Button>
            <Button onClick={handleCreateUser} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

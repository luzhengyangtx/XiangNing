"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import type { InventoryItem, WarehouseStockItem } from "@/lib/api";
import { fetchInventory, fetchWarehouses, adjustStock, adjustStockBatch, toggleUnattendedMode } from "@/lib/api";
import { toast } from "sonner";
import { Search, Plus, Minus, Loader2, RotateCw, ChevronDown, Package, AlertTriangle, XCircle } from "lucide-react";

interface Warehouse {
  id: string; name: string; code: string; isUnattendedMode: boolean;
}

const platformNames: Record<string, string> = { meituan: "美团", eleme: "饿了么", jddj: "京东", douyin: "抖音" };
const platformColor: Record<string, string> = { synced: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", failed: "bg-red-100 text-red-700" };
const platformLabel: Record<string, string> = { synced: "正常", pending: "待同步", failed: "异常" };

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncFailures, setSyncFailures] = useState(0);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Batch
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDelta, setBatchDelta] = useState(0);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      const whs = await fetchWarehouses();
      setWarehouses(whs);
      if (!activeWarehouse && whs.length > 0) setActiveWarehouse(whs[0].code);
    } catch { /* ignore */ }
  }, [activeWarehouse]);

  const activeWh = warehouses.find((w) => w.code === activeWarehouse);

  const loadData = useCallback(async () => {
    if (!activeWh) return;
    setLoading(true);
    try {
      const res = await fetchInventory({
        search: search || undefined,
        category: category === "all" ? undefined : category,
        warehouseId: activeWh.id,
      });
      setData(res.items);
      setCategories(res.categories);
      setTotalCount(res.totalCount);
      setLowStockCount(res.lowStockCount);
      setSyncFailures(res.syncFailures);
    } finally { setLoading(false); }
  }, [search, category, activeWh]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) loadWarehouses();
  }, [authLoading, user, router, loadWarehouses]);

  useEffect(() => { if (activeWh) loadData(); }, [loadData, activeWh]);

  const handleAdjust = async (productId: string, delta: number, isUnattended?: boolean) => {
    if (!activeWh) return;
    setAdjusting(productId);
    try {
      const r = await adjustStock(productId, activeWh.id, delta, isUnattended);
      setData((prev) => prev.map((i) => i.id === productId ? {
        ...i, currentStock: r.currentStock, unattendedStock: r.unattendedStock,
        warehouseStocks: i.warehouseStocks.map((ws) =>
          ws.warehouseId === activeWh.id ? { ...ws, stock: r.currentStock, unattendedStock: r.unattendedStock } : ws
        ),
      } : i));
      toast.success(delta > 0 ? `库存 +${delta}` : `库存 ${delta}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setAdjusting(null); }
  };

  const handleBatch = async () => {
    if (!activeWh || batchDelta === 0) return;
    setBatchLoading(true);
    try {
      const items = Array.from(selected).map((id) => ({ productId: id, warehouseId: activeWh.id, delta: batchDelta }));
      await adjustStockBatch(items, batchReason);
      toast.success("批量操作完成");
      setBatchOpen(false); setSelected(new Set()); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "批量操作失败"); }
    finally { setBatchLoading(false); }
  };

  const handleToggleUnattended = async (wh: Warehouse) => {
    try {
      const updated = await toggleUnattendedMode(wh.id, !wh.isUnattendedMode);
      setWarehouses((prev) => prev.map((w) => w.id === wh.id ? { ...w, isUnattendedMode: updated.isUnattendedMode } : w));
      toast.success(updated.isUnattendedMode ? "无人值守模式已开启" : "无人值守模式已关闭");
    } catch { toast.error("切换失败"); }
  };

  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">库存看板</h1>
          <p className="text-sm text-muted-foreground">按门店管理库存 · 实时平台同步状态</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}><RotateCw className="mr-1 h-3 w-3" />刷新</Button>
      </div>

      {/* Warehouse Tabs */}
      <Tabs value={activeWarehouse} onValueChange={setActiveWarehouse}>
        <div className="flex items-center justify-between">
          <TabsList>
            {warehouses.map((wh) => (
              <TabsTrigger key={wh.code} value={wh.code} className="gap-2">
                {wh.name}
                {wh.isUnattendedMode && (
                  <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300">无人值守</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeWh && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">无人值守模式</Label>
              <Switch checked={activeWh.isUnattendedMode} onCheckedChange={() => handleToggleUnattended(activeWh)} />
            </div>
          )}
        </div>

        {warehouses.map((wh) => (
          <TabsContent key={wh.code} value={wh.code} className="space-y-4 mt-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Package className="h-6 w-6 text-primary" /></div>
                  <div><p className="text-sm text-muted-foreground">{wh.name}商品数</p><p className="text-2xl font-bold">{totalCount}</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100"><AlertTriangle className="h-6 w-6 text-orange-600" /></div>
                  <div><p className="text-sm text-muted-foreground">低库存商品</p><p className="text-2xl font-bold">{lowStockCount}</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100"><XCircle className="h-6 w-6 text-red-600" /></div>
                  <div><p className="text-sm text-muted-foreground">今日同步失败</p><p className="text-2xl font-bold">{syncFailures}</p></div>
                </CardContent>
              </Card>
            </div>

            {/* Inventory Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>商品库存</CardTitle>
                  {selected.size > 0 && <Button size="sm" onClick={() => setBatchOpen(true)}>批量操作 ({selected.size})</Button>}
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="搜索商品标题 / SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="全部分类" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">全部分类</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>商品标题</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead className="text-right">售价</TableHead>
                      <TableHead className="text-right">库存</TableHead>
                      <TableHead className="text-right">无人值守</TableHead>
                      <TableHead>平台状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                    ) : data.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">未找到匹配的商品</TableCell></TableRow>
                    ) : (
                      data.map((item) => {
                        const whStock = item.warehouseStocks.find((ws) => ws.warehouseId === wh.id);
                        return (
                          <>
                            <TableRow key={item.id} className={selected.has(item.id) ? "bg-muted/50" : ""}>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const n = new Set(expandedRows); n.has(item.id) ? n.delete(item.id) : n.add(item.id); setExpandedRows(n); }}>
                                  <ChevronDown className={`h-3 w-3 transition ${expandedRows.has(item.id) ? "" : "-rotate-90"}`} />
                                </Button>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                              <TableCell className="font-medium max-w-[180px] truncate" title={item.title}>{item.title}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-xs">{item.categoryL1}</Badge></TableCell>
                              <TableCell className="text-right text-sm font-medium text-primary">¥{item.discountPrice.toFixed(0)}</TableCell>
                              <TableCell className="text-right">
                                <span className={whStock && whStock.stock < item.safetyStock ? "font-bold text-red-600" : ""}>{whStock?.stock ?? 0}</span>
                                <span className="text-xs text-muted-foreground"> / {item.safetyStock}</span>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{whStock?.unattendedStock ?? 0}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {Object.entries(item.platformStatus || {}).map(([code, ps]) => (
                                    <Badge key={code} variant="outline" className={`text-[10px] px-1 ${platformColor[ps.status] || "bg-gray-100"}`} title={ps.errorMessage || ""}>
                                      {platformNames[code]}: {platformLabel[ps.status] || "未绑定"}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                                  <span className="w-8 text-center text-sm">{whStock?.stock ?? 0}</span>
                                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Expanded row */}
                            {expandedRows.has(item.id) && whStock && (
                              <TableRow key={`${item.id}-detail`} className="bg-muted/30">
                                <TableCell colSpan={9} className="p-4">
                                  <div className="grid grid-cols-5 gap-3 text-xs">
                                    <div><span className="text-muted-foreground">北京编号:</span> {item.beijingId || "-"}</div>
                                    <div><span className="text-muted-foreground">进价:</span> ¥{item.costPrice.toFixed(0)}</div>
                                    <div><span className="text-muted-foreground">重量:</span> {item.weight ? `${item.weight}g` : "-"}</div>
                                    <div><span className="text-muted-foreground">货架编号:</span> {whStock.shelfId || "-"}</div>
                                    <div><span className="text-muted-foreground">货损库存:</span> {whStock.damagedStock}</div>
                                    <div className="col-span-5">
                                      <span className="text-muted-foreground">平台同步:</span>
                                      <div className="flex gap-2 mt-1">
                                        {Object.entries(item.platformStatus || {}).map(([code, ps]) => (
                                          <Badge key={code} variant="outline" className={`text-[10px] ${ps.status === "failed" ? "bg-red-100 text-red-700" : ps.status === "synced" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {platformNames[code]}: {ps.status === "failed" ? (ps.errorMessage || "同步失败") : platformLabel[ps.status] || "未绑定"}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Batch Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量调整库存</DialogTitle><DialogDescription>已选择 {selected.size} 个商品 · {activeWh?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>调整数量</Label><Input type="number" value={batchDelta} onChange={(e) => setBatchDelta(Number(e.target.value))} placeholder="+10 或 -5" /></div>
            <div className="space-y-2"><Label>操作原因</Label><Textarea value={batchReason} onChange={(e) => setBatchReason(e.target.value)} placeholder="进货入库" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button><Button onClick={handleBatch} disabled={batchDelta === 0 || batchLoading}>{batchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}确认</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

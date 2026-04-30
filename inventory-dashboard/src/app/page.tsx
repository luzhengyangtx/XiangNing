"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatsCards } from "@/components/stats-cards";
import { useAuth } from "@/lib/auth-context";
import type { InventoryItem } from "@/lib/api";
import { fetchInventory, adjustStock, adjustStockBatch } from "@/lib/api";
import { toast } from "sonner";
import { Search, ArrowUpDown, Plus, Minus, Loader2, RotateCw, ChevronDown } from "lucide-react";

const platformLabel: Record<string, string> = { synced: "正常", pending: "待同步", failed: "异常" };
const platformColor: Record<string, string> = { synced: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", failed: "bg-red-100 text-red-700" };

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortCol, setSortCol] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncFailures, setSyncFailures] = useState(0);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDelta, setBatchDelta] = useState(0);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInventory({
        search: search || undefined,
        category: category === "all" ? undefined : category,
        sortCol, sortDir,
      });
      setData(res.items);
      setCategories(res.categories);
      setTotalCount(res.totalCount);
      setLowStockCount(res.lowStockCount);
      setSyncFailures(res.syncFailures);
    } finally { setLoading(false); }
  }, [search, category, sortCol, sortDir]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) loadData();
  }, [authLoading, user, router, loadData]);

  const handleAdjust = async (productId: string, delta: number) => {
    setAdjusting(productId);
    try {
      const r = await adjustStock(productId, delta);
      setData((p) => p.map((i) => i.id === productId ? { ...i, currentStock: r.currentStock } : i));
      toast.success(delta > 0 ? `库存 +${delta}` : `库存 ${delta}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setAdjusting(null); }
  };

  const handleBatchAdjust = async () => {
    if (batchDelta === 0) return;
    setBatchLoading(true);
    try {
      const items = Array.from(selected).map((id) => ({ productId: id, delta: batchDelta }));
      await adjustStockBatch(items, batchReason);
      toast.success("批量操作完成");
      setBatchOpen(false); setSelected(new Set()); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "批量操作失败"); }
    finally { setBatchLoading(false); }
  };

  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">库存看板</h1>
        <p className="text-sm text-muted-foreground">多仓库库存 · 平台同步状态实时监控</p>
      </div>

      <StatsCards totalProducts={totalCount} lowStockCount={lowStockCount} syncFailures={syncFailures} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>商品列表</CardTitle>
            <div className="flex gap-2">
              {selected.size > 0 && (
                <Button size="sm" onClick={() => setBatchOpen(true)}>批量操作 ({selected.size})</Button>
              )}
              <Button variant="outline" size="sm" onClick={loadData}><RotateCw className="mr-1 h-3 w-3" />刷新</Button>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="搜索商品标题 / SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="全部分类" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"><Checkbox checked={selected.size === data.length && data.length > 0} onCheckedChange={() => selected.size === data.length ? setSelected(new Set()) : setSelected(new Set(data.map(i => i.id)))} /></TableHead>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>商品标题</TableHead>
                <TableHead>分类</TableHead>
                <TableHead className="text-right">原价</TableHead>
                <TableHead className="text-right">售价</TableHead>
                <TableHead className="text-right">库存</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">未找到匹配的商品</TableCell></TableRow>
              ) : (
                data.map((item) => (
                  <>
                    <TableRow key={item.id} className={selected.has(item.id) ? "bg-muted/50" : ""}>
                      <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={() => { const n = new Set(selected); n.has(item.id) ? n.delete(item.id) : n.add(item.id); setSelected(n); }} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const n = new Set(expandedRows); n.has(item.id) ? n.delete(item.id) : n.add(item.id); setExpandedRows(n); }}>
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedRows.has(item.id) ? "rotate-0" : "-rotate-90"}`} />
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={item.title}>{item.title}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="secondary" className="text-xs">{item.categoryL1}</Badge>
                          {item.categoryL2 && <span className="text-[10px] text-muted-foreground">{item.categoryL2}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">¥{item.originalPrice.toFixed(0)}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-primary">¥{item.discountPrice.toFixed(0)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.currentStock < item.safetyStock ? "font-bold text-red-600" : ""}>{item.currentStock}</span>
                        <span className="text-xs text-muted-foreground"> / {item.safetyStock}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                          <span className="w-8 text-center text-sm">{item.currentStock}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(item.id) && (
                      <TableRow key={`${item.id}-detail`} className="bg-muted/30">
                        <TableCell colSpan={9} className="p-4">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">北京编号: </span>
                              <span className="font-mono">{item.beijingId || "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">进价: </span>
                              <span>¥{item.costPrice.toFixed(0)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">重量: </span>
                              <span>{item.weight ? `${item.weight}g` : "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">单位: </span>
                              <span>{item.unit}</span>
                            </div>
                            <div className="col-span-4">
                              <span className="text-muted-foreground text-xs">仓库库存: </span>
                              <div className="flex gap-2 mt-1">
                                {item.warehouseStocks?.map((ws, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {ws.warehouseName}: {ws.stock}
                                    {ws.shelfId && <> [{ws.shelfId}]</>}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量调整库存</DialogTitle><DialogDescription>已选择 {selected.size} 个商品</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>调整数量</Label><Input type="number" value={batchDelta} onChange={(e) => setBatchDelta(Number(e.target.value))} placeholder="+10 或 -5" /></div>
            <div className="space-y-2"><Label>操作原因</Label><Textarea value={batchReason} onChange={(e) => setBatchReason(e.target.value)} placeholder="进货入库" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button onClick={handleBatchAdjust} disabled={batchDelta === 0 || batchLoading}>{batchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

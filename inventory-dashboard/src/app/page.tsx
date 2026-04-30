"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/lib/api";
import {
  fetchInventory, adjustStock, adjustStockBatch, fetchWarehouses, fetchPlatforms,
  createProduct, updateProduct, deleteProduct, uploadImage, toggleUnattendedMode,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Loader2, RotateCw, ChevronDown, ChevronRight,
  Package, AlertTriangle, XCircle, Pencil, Trash2, Upload, Folder, FolderOpen,
} from "lucide-react";

interface Warehouse { id: string; name: string; code: string; isUnattendedMode: boolean; }
interface PlatformItem { id: string; name: string; code: string; status: string; }

const platformNames: Record<string, string> = { meituan: "美团", eleme: "饿了么", jddj: "京东", douyin: "抖音" };

const defaultForm = {
  sku: "", title: "", onlineSpec: "", beijingId: "", originalPrice: 0, discountPrice: 0, costPrice: 0,
  weight: "", categoryL1: "", categoryL2: "", mainImage: "", shippingSampleImage: "", link: "",
  purchaseSpec: "", jdSku: "", packagingMaterial: "", packagingPrice: 0, description: "", unit: "束", safetyStock: 0,
};

export default function UnifiedInventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Data ──
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [activeWhCode, setActiveWhCode] = useState("");
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncFailures, setSyncFailures] = useState(0);

  // ── Category tree ──
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());

  // ── Table ──
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Batch ──
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDelta, setBatchDelta] = useState(0);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  // ── Edit Sheet ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [syncTargets, setSyncTargets] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  // ── Delete ──
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activeWh = warehouses.find((w) => w.code === activeWhCode);

  // ── Load ──
  const loadWarehouses = useCallback(async () => {
    const whs = await fetchWarehouses();
    setWarehouses(whs);
    if (!activeWhCode && whs.length) setActiveWhCode(whs[0].code);
  }, [activeWhCode]);

  const loadPlatforms = useCallback(async () => {
    try { setPlatforms(await fetchPlatforms()); } catch { /* ignore */ }
  }, []);

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
      setLowStockCount(res.lowStockCount);
      setSyncFailures(res.syncFailures);
    } finally { setLoading(false); }
  }, [search, category, activeWh]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) { loadWarehouses(); loadPlatforms(); }
  }, [authLoading, user, router, loadWarehouses, loadPlatforms]);

  useEffect(() => { if (activeWh) loadData(); }, [loadData, activeWh]);

  // ── Category tree ──
  const categoryTree = useMemo(() => {
    const map = new Map<string, { l2s: Map<string, number>; total: number }>();
    data.forEach((p) => {
      if (!map.has(p.categoryL1)) map.set(p.categoryL1, { l2s: new Map(), total: 0 });
      const e = map.get(p.categoryL1)!;
      e.total++;
      if (p.categoryL2) e.l2s.set(p.categoryL2, (e.l2s.get(p.categoryL2) || 0) + 1);
    });
    return map;
  }, [data]);

  const filteredData = useMemo(() => {
    let f = data;
    if (selectedL1) {
      f = f.filter((p) => p.categoryL1 === selectedL1);
      if (selectedL2) f = f.filter((p) => p.categoryL2 === selectedL2);
    }
    return f;
  }, [data, selectedL1, selectedL2]);

  const categories = useMemo(() => Array.from(new Set(data.map((p) => p.categoryL1))), [data]);

  // ── Stock adjust ──
  const handleAdjust = async (productId: string, delta: number, isUnattended?: boolean) => {
    if (!activeWh) return;
    setAdjusting(productId);
    try {
      const r = await adjustStock(productId, activeWh.id, delta, isUnattended);
      setData((prev) => prev.map((i) =>
        i.id === productId ? {
          ...i, currentStock: r.currentStock, unattendedStock: r.unattendedStock,
          warehouseStocks: i.warehouseStocks.map((ws) =>
            ws.warehouseId === activeWh.id ? { ...ws, stock: r.currentStock, unattendedStock: r.unattendedStock } : ws
          ),
        } : i
      ));
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setAdjusting(null); }
  };

  const handleBatch = async () => {
    if (!activeWh || batchDelta === 0) return;
    setBatchLoading(true);
    try {
      await adjustStockBatch(
        Array.from(selected).map((id) => ({ productId: id, warehouseId: activeWh.id, delta: batchDelta })),
        batchReason,
      );
      toast.success("批量操作完成"); setBatchOpen(false); setSelected(new Set()); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
    finally { setBatchLoading(false); }
  };

  const handleToggleUnattended = async (wh: Warehouse) => {
    const updated = await toggleUnattendedMode(wh.id, !wh.isUnattendedMode);
    setWarehouses((prev) => prev.map((w) => w.id === wh.id ? { ...w, isUnattendedMode: updated.isUnattendedMode } : w));
  };

  // ── Product CRUD ──
  const openCreate = () => { setEditing(null); setForm(defaultForm); setSyncTargets(new Set()); setSheetOpen(true); };
  const openEdit = (p: InventoryItem) => {
    setEditing(p as unknown as Record<string, unknown>);
    setForm({
      sku: p.sku, title: p.title, onlineSpec: "", beijingId: p.beijingId || "",
      originalPrice: p.originalPrice, discountPrice: p.discountPrice, costPrice: p.costPrice,
      weight: p.weight ? String(p.weight) : "", categoryL1: p.categoryL1, categoryL2: p.categoryL2 || "",
      mainImage: "", shippingSampleImage: "", link: "", purchaseSpec: "", jdSku: "",
      packagingMaterial: "", packagingPrice: 0, description: "", unit: p.unit, safetyStock: p.safetyStock,
    });
    setSyncTargets(new Set(platforms.filter((pl) => pl.status === "connected").map((pl) => pl.id)));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.sku || !form.title || !form.categoryL1) { toast.error("请填写必填字段"); return; }
    setSaving(true);
    try {
      const payload = { ...form, weight: form.weight ? Number(form.weight) : null };
      if (editing) {
        await updateProduct(editing.id as string, payload);
        for (const pid of syncTargets) {
          try { await fetch("/api/sync-tasks/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformId: pid }) }); } catch { /* */ }
        }
        toast.success(syncTargets.size > 0 ? "已保存并触发同步" : "已更新");
      } else {
        await createProduct(payload);
        toast.success("已创建");
      }
      setSheetOpen(false); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    for (const id of selected) await deleteProduct(id);
    toast.success(`已删除 ${selected.size} 个`); setSelected(new Set()); setDeleteOpen(false); loadData();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try { setForm((prev) => ({ ...prev, [field]: await uploadImage(f) })); toast.success("上传成功"); }
    catch { toast.error("上传失败"); }
    finally { setUploading(false); }
  };

  // ── Render ──
  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <h1 className="text-lg font-bold">商品库存</h1>
        <div className="flex items-center gap-3">
          <Tabs value={activeWhCode} onValueChange={setActiveWhCode}>
            <TabsList>
              {warehouses.map((wh) => (
                <TabsTrigger key={wh.code} value={wh.code} className="gap-1.5">
                  {wh.name}
                  {wh.isUnattendedMode && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300 px-1">无人</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {activeWh && (
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">无人值守</Label>
              <Switch checked={activeWh.isUnattendedMode} onCheckedChange={() => handleToggleUnattended(activeWh)} />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={loadData}><RotateCw className="mr-1 h-3 w-3" />刷新</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Category Tree */}
        <aside className="w-[200px] border-r bg-white p-3 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold">商品分类</h3>
            <button className="text-xs text-muted-foreground hover:text-primary" onClick={() => { setSelectedL1(null); setSelectedL2(null); }}>
              全部 ({data.length})
            </button>
          </div>
          <ScrollArea className="flex-1 -mx-1 px-1">
            {Array.from(categoryTree.entries()).map(([l1, d]) => (
              <div key={l1}>
                <button
                  onClick={() => {
                    setSelectedL1(l1); setSelectedL2(null);
                    setExpandedL1((prev) => { const n = new Set(prev); n.has(l1) ? n.delete(l1) : n.add(l1); return n; });
                  }}
                  className={cn("flex items-center gap-1 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-muted", selectedL1 === l1 && !selectedL2 && "bg-primary/10 text-primary font-medium")}
                >
                  {d.l2s.size > 0 ? <ChevronRight className={cn("h-3 w-3 shrink-0 transition", expandedL1.has(l1) && "rotate-90")} /> : <span className="w-3" />}
                  {expandedL1.has(l1) ? <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" /> : <Folder className="h-3 w-3 shrink-0 text-amber-500" />}
                  <span className="flex-1 truncate text-left">{l1}</span>
                  <span className="text-[10px] text-muted-foreground">{d.total}</span>
                </button>
                {expandedL1.has(l1) && Array.from(d.l2s.entries()).map(([l2, count]) => (
                  <button key={l2} onClick={() => { setSelectedL1(l1); setSelectedL2(l2); }}
                    className={cn("block w-full text-left text-[11px] py-0.5 pl-6 rounded hover:bg-muted", selectedL2 === l2 && "bg-primary/10 text-primary font-medium")}>
                    {l2} <span className="text-muted-foreground">({count})</span>
                  </button>
                ))}
              </div>
            ))}
          </ScrollArea>
        </aside>

        {/* Right: Main content */}
        <main className="flex-1 overflow-auto p-4">
          {/* Stats + Search bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 text-primary" />{data.length} 个商品</span>
              <span className="flex items-center gap-1 text-orange-600"><AlertTriangle className="h-3.5 w-3.5" />{lowStockCount} 低库存</span>
              <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" />{syncFailures} 同步失败</span>
            </div>
            <div className="relative flex-1 max-w-xs ml-auto">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-7 pl-7 text-xs" placeholder="搜索标题/SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="全部分类" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mb-2">
            <div>
              {selected.size > 0 && (
                <span className="text-xs text-muted-foreground mr-2">已选 {selected.size} 项</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {selected.size > 0 && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBatchOpen(true)}>批量调整</Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-3 w-3" />删除</Button>
                </>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={openCreate}><Plus className="mr-1 h-3 w-3" />新增商品</Button>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-15rem)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead className="w-[85px] text-xs">SKU</TableHead>
                      <TableHead className="text-xs">标题</TableHead>
                      <TableHead className="w-[70px] text-xs">分类</TableHead>
                      <TableHead className="w-[55px] text-right text-xs">原价</TableHead>
                      <TableHead className="w-[55px] text-right text-xs">售价</TableHead>
                      <TableHead className="w-[50px] text-right text-xs">进价</TableHead>
                      <TableHead className="w-[55px] text-right text-xs">库存</TableHead>
                      <TableHead className="w-[50px] text-right text-xs">无人</TableHead>
                      <TableHead className="w-[80px] text-xs">平台</TableHead>
                      <TableHead className="w-[110px] text-right text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={11} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                    ) : filteredData.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="h-24 text-center text-xs text-muted-foreground">暂无商品</TableCell></TableRow>
                    ) : (
                      filteredData.map((item) => {
                        const ws = item.warehouseStocks.find((w) => w.warehouseId === activeWh?.id);
                        const isLow = (ws?.stock ?? 0) < item.safetyStock;
                        return (
                          <React.Fragment key={item.id}>
                            <TableRow className={cn(selected.has(item.id) && "bg-muted/50", isLow && "bg-red-50/30")}>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { const n = new Set(expandedRows); n.has(item.id) ? n.delete(item.id) : n.add(item.id); setExpandedRows(n); }}>
                                  <ChevronDown className={cn("h-3 w-3 transition", expandedRows.has(item.id) ? "" : "-rotate-90")} />
                                </Button>
                              </TableCell>
                              <TableCell className="font-mono text-[11px] py-1.5">{item.sku}</TableCell>
                              <TableCell className="text-xs py-1.5 max-w-[200px] truncate" title={item.title}>{item.title}</TableCell>
                              <TableCell className="py-1.5"><Badge variant="secondary" className="text-[10px]">{item.categoryL1}</Badge></TableCell>
                              <TableCell className="text-right text-[11px] py-1.5">¥{item.originalPrice.toFixed(0)}</TableCell>
                              <TableCell className="text-right text-[11px] font-medium text-primary py-1.5">¥{item.discountPrice.toFixed(0)}</TableCell>
                              <TableCell className="text-right text-[11px] text-muted-foreground py-1.5">¥{item.costPrice.toFixed(0)}</TableCell>
                              <TableCell className="text-right py-1.5">
                                <span className={cn("text-xs", isLow && "font-bold text-red-600")}>{ws?.stock ?? 0}</span>
                                <span className="text-[10px] text-muted-foreground">/{item.safetyStock}</span>
                              </TableCell>
                              <TableCell className="text-right text-[11px] text-muted-foreground py-1.5">{ws?.unattendedStock ?? 0}</TableCell>
                              <TableCell className="py-1.5">
                                <div className="flex gap-0.5">
                                  {Object.entries(item.platformStatus || {}).map(([code, ps]) => (
                                    <Tooltip key={code}>
                                      <TooltipTrigger asChild>
                                        <span className={cn("inline-block w-2 h-2 rounded-full cursor-default",
                                          ps.status === "synced" ? "bg-green-500" : ps.status === "failed" ? "bg-red-500" : ps.status === "pending" ? "bg-yellow-500" : "bg-gray-300")} />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-[10px]">
                                        {platformNames[code]}: {ps.status === "synced" ? "正常" : ps.status === "failed" ? ps.errorMessage || "异常" : ps.status === "pending" ? "待同步" : "未绑定"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-1.5">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="outline" size="icon" className="h-6 w-6" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                                  <span className="w-7 text-center text-[11px]">{ws?.stock ?? 0}</span>
                                  <Button variant="outline" size="icon" className="h-6 w-6" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-0.5" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Expanded detail row */}
                            {expandedRows.has(item.id) && ws && (
                              <TableRow key={`${item.id}-exp`} className="bg-muted/30">
                                <TableCell colSpan={11} className="p-3">
                                  <div className="grid grid-cols-6 gap-2 text-[11px]">
                                    <div><span className="text-muted-foreground">北京编号:</span> {item.beijingId || "-"}</div>
                                    <div><span className="text-muted-foreground">重量:</span> {item.weight ? `${item.weight}g` : "-"}</div>
                                    <div><span className="text-muted-foreground">单位:</span> {item.unit}</div>
                                    <div><span className="text-muted-foreground">货架:</span> {ws.shelfId || "-"}</div>
                                    <div><span className="text-muted-foreground">货损:</span> {ws.damagedStock}</div>
                                    <div><span className="text-muted-foreground">无人值守库存:</span> {ws.unattendedStock}</div>
                                    <div className="col-span-6 flex gap-2 items-center flex-wrap">
                                      <span className="text-muted-foreground shrink-0">平台状态:</span>
                                      {Object.entries(item.platformStatus || {}).map(([code, ps]) => (
                                        <Badge key={code} variant="outline" className={cn("text-[10px]", ps.status === "failed" ? "bg-red-100 text-red-700 border-red-300" : ps.status === "synced" ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-500")}>
                                          {platformNames[code]}: {ps.status === "failed" ? ps.errorMessage || "异常" : ps.status === "synced" ? "正常" : "未绑定"}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Batch Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量调整库存</DialogTitle><DialogDescription>{selected.size} 个商品 · {activeWh?.name}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1"><Label className="text-xs">调整数量</Label><Input type="number" value={batchDelta} onChange={(e) => setBatchDelta(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">操作原因</Label><Textarea value={batchReason} onChange={(e) => setBatchReason(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setBatchOpen(false)}>取消</Button><Button size="sm" onClick={handleBatch} disabled={batchDelta === 0 || batchLoading}>{batchLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}确认</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>删除选中的 {selected.size} 个商品，不可撤销。</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>取消</Button><Button size="sm" variant="destructive" onClick={handleDelete}>确认删除</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-[520px] w-full p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 pt-5 pb-2">
              <SheetTitle>{editing ? "编辑商品" : "新增商品"}</SheetTitle>
              <SheetDescription>{editing ? "修改信息并同步到平台" : "填写基本信息"}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 px-6">
              <div className="grid gap-2.5 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">SKU *</Label><Input className="h-7 text-xs" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!editing} /></div>
                  <div><Label className="text-[11px]">北京编号</Label><Input className="h-7 text-xs" value={form.beijingId} onChange={(e) => setForm({ ...form, beijingId: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">一级分类 *</Label><Input className="h-7 text-xs" value={form.categoryL1} onChange={(e) => setForm({ ...form, categoryL1: e.target.value })} /></div>
                  <div><Label className="text-[11px]">二级分类</Label><Input className="h-7 text-xs" value={form.categoryL2} onChange={(e) => setForm({ ...form, categoryL2: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div><Label className="text-[11px]">原价</Label><Input className="h-7 text-xs" type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-[11px]">售价</Label><Input className="h-7 text-xs" type="number" step="0.01" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-[11px]">进价</Label><Input className="h-7 text-xs" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-[11px]">耗材价</Label><Input className="h-7 text-xs" type="number" step="0.01" value={form.packagingPrice} onChange={(e) => setForm({ ...form, packagingPrice: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[11px]">单位</Label><Input className="h-7 text-xs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                  <div><Label className="text-[11px]">重量(g)</Label><Input className="h-7 text-xs" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
                  <div><Label className="text-[11px]">安全库存</Label><Input className="h-7 text-xs" type="number" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">包装耗材</Label><Input className="h-7 text-xs" value={form.packagingMaterial} onChange={(e) => setForm({ ...form, packagingMaterial: e.target.value })} /></div>
                  <div><Label className="text-[11px]">1688链接</Label><Input className="h-7 text-xs" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">线上规格</Label><Input className="h-7 text-xs" value={form.onlineSpec} onChange={(e) => setForm({ ...form, onlineSpec: e.target.value })} /></div>
                  <div><Label className="text-[11px]">京东SKU</Label><Input className="h-7 text-xs" value={form.jdSku} onChange={(e) => setForm({ ...form, jdSku: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">主图</Label>
                    <div className="flex items-center gap-1 mt-0.5">{form.mainImage && <img src={form.mainImage} className="h-8 w-8 rounded object-cover" />}
                      <label className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted"><Upload className="inline h-2.5 w-2.5 mr-0.5" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "mainImage")} /></label></div>
                  </div>
                  <div><Label className="text-[11px]">出库样图</Label>
                    <div className="flex items-center gap-1 mt-0.5">{form.shippingSampleImage && <img src={form.shippingSampleImage} className="h-8 w-8 rounded object-cover" />}
                      <label className="cursor-pointer rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted"><Upload className="inline h-2.5 w-2.5 mr-0.5" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "shippingSampleImage")} /></label></div>
                  </div>
                </div>
                {editing && (
                  <div className="border-t pt-2 mt-1">
                    <Label className="text-[11px] font-medium mb-1.5 block">同步到平台（保存后推送）</Label>
                    <div className="flex flex-wrap gap-2">
                      {platforms.map((p) => (
                        <label key={p.id} className="flex items-center gap-1 cursor-pointer text-xs">
                          <input type="checkbox" className="h-3 w-3 rounded" checked={syncTargets.has(p.id)} onChange={() => { const n = new Set(syncTargets); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setSyncTargets(n); }} disabled={p.status !== "connected"} />
                          {platformNames[p.code] || p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <SheetFooter className="px-6 pb-5 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}{editing ? "保存" : "创建"}</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryTree } from "@/components/category-tree";
import { ProductCard } from "@/components/product-card";
import { ProductEditSheet } from "@/components/product-edit-sheet";
import type { InventoryItem } from "@/lib/api";
import {
  fetchInventory, adjustStock, adjustStockBatch, fetchWarehouses, fetchPlatforms,
  deleteProduct, toggleUnattendedMode,
} from "@/lib/api";
import { toast } from "sonner";
import { Search, Plus, Loader2, RotateCw, Package, AlertTriangle, XCircle, Trash2 } from "lucide-react";

interface Warehouse { id: string; name: string; code: string; isUnattendedMode: boolean; }
interface PlatformItem { id: string; name: string; code: string; status: string; }

export default function UnifiedInventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Core state ──
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [activeWhCode, setActiveWhCode] = useState("");
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shelvesTab, setShelvesTab] = useState("all"); // all | on | off | low
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncFailures, setSyncFailures] = useState(0);

  // ── Category tree ──
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Edit sheet ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  // ── Dialogs ──
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDelta, setBatchDelta] = useState(0);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const activeWh = warehouses.find((w) => w.code === activeWhCode);

  // ── Load data ──
  const loadWarehouses = useCallback(async () => {
    const whs = await fetchWarehouses();
    setWarehouses(whs);
    if (!activeWhCode && whs.length) setActiveWhCode(whs[0].code);
  }, [activeWhCode]);

  const loadPlatforms = useCallback(async () => {
    try { setPlatforms(await fetchPlatforms()); } catch { /* */ }
  }, []);

  const loadData = useCallback(async () => {
    if (!activeWh) return;
    setLoading(true);
    try {
      const res = await fetchInventory({
        search: search || undefined,
        warehouseId: activeWh.id,
      });
      setData(res.items);
      setLowStockCount(res.lowStockCount);
      setSyncFailures(res.syncFailures);
    } finally { setLoading(false); }
  }, [search, activeWh]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) { loadWarehouses(); loadPlatforms(); }
  }, [authLoading, user, router, loadWarehouses, loadPlatforms]);

  useEffect(() => { if (activeWh) loadData(); }, [loadData, activeWh]);

  // ── Filtered data ──
  const filteredData = useMemo(() => {
    let f = data;
    // Category filter
    if (selectedL1) {
      f = f.filter((p) => p.categoryL1 === selectedL1);
      if (selectedL2) f = f.filter((p) => p.categoryL2 === selectedL2);
    }
    // Shelves tab filter
    if (shelvesTab === "on") {
      f = f.filter((p) => Object.values(p.platformStatus).some((ps) => ps.shelvesStatus === "on"));
    } else if (shelvesTab === "off") {
      f = f.filter((p) => {
        const statuses = Object.values(p.platformStatus);
        return statuses.length === 0 || statuses.every((ps) => ps.shelvesStatus !== "on");
      });
    } else if (shelvesTab === "low") {
      f = f.filter((p) => {
        const ws = p.warehouseStocks.find((w) => w.warehouseId === activeWh?.id);
        return (ws?.stock ?? 0) < p.safetyStock;
      });
    }
    return f;
  }, [data, selectedL1, selectedL2, shelvesTab, activeWh]);

  // ── Handlers ──
  const handleAdjust = async (productId: string, delta: number, isUnattended?: boolean) => {
    if (!activeWh) return;
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
    } catch (e) { toast.error(e instanceof Error ? e.message : "调整失败"); }
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

  const handleDelete = async () => {
    for (const id of selected) await deleteProduct(id);
    toast.success(`已删除 ${selected.size} 个`); setSelected(new Set()); setDeleteOpen(false); loadData();
  };

  const handleToggleUnattended = async (wh: Warehouse) => {
    const updated = await toggleUnattendedMode(wh.id, !wh.isUnattendedMode);
    setWarehouses((prev) => prev.map((w) => w.id === wh.id ? { ...w, isUnattendedMode: updated.isUnattendedMode } : w));
  };

  const handleEdit = (item: InventoryItem) => {
    setEditing(item as unknown as Record<string, unknown>);
    setSheetOpen(true);
  };

  const handleCreate = () => { setEditing(null); setSheetOpen(true); };

  const shelvesTabs = [
    { value: "all", label: "全部" },
    { value: "on", label: "上架中" },
    { value: "off", label: "已下架" },
    { value: "low", label: "低库存" },
  ];

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
                  {wh.isUnattendedMode && (
                    <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-300 px-1">无人</Badge>
                  )}
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
        <CategoryTree
          data={data}
          selectedL1={selectedL1}
          selectedL2={selectedL2}
          onSelect={(l1, l2) => { setSelectedL1(l1); setSelectedL2(l2); }}
        />

        {/* Right: Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Stats + Toolbar */}
          <div className="px-4 pt-3 pb-2 border-b bg-white">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center gap-1 text-xs"><Package className="h-3.5 w-3.5 text-primary" />{data.length} 个商品</span>
              <span className="flex items-center gap-1 text-xs text-orange-600"><AlertTriangle className="h-3.5 w-3.5" />{lowStockCount} 低库存</span>
              <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="h-3.5 w-3.5" />{syncFailures} 同步失败</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Shelves status tabs */}
              <Tabs value={shelvesTab} onValueChange={setShelvesTab}>
                <TabsList className="h-7">
                  {shelvesTabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs h-7 px-2.5">{t.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative flex-1 max-w-[220px]">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-7 pl-7 text-xs" placeholder="搜索标题/SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5 ml-auto">
                {selected.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground self-center mr-1">已选 {selected.size} 项</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBatchOpen(true)}>批量调整</Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-3 w-3" />删除</Button>
                  </>
                )}
                <Button size="sm" className="h-7 text-xs" onClick={handleCreate}><Plus className="mr-1 h-3 w-3" />新增商品</Button>
              </div>
            </div>
          </div>

          {/* Product list */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filteredData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                {shelvesTab !== "all" ? "当前筛选条件无匹配商品" : "暂无商品，点击右上方新增"}
              </div>
            ) : (
              filteredData.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  platforms={platforms}
                  activeWhId={activeWh?.id ?? ""}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => {
                    const n = new Set(selected);
                    n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                    setSelected(n);
                  }}
                  onAdjust={handleAdjust}
                  onEdit={handleEdit}
                  onShelvesChange={loadData}
                />
              ))
            )}
          </ScrollArea>
        </main>
      </div>

      {/* Batch Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量调整库存</DialogTitle><DialogDescription>{selected.size} 个商品 · {activeWh?.name}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1"><Label className="text-xs">调整数量（正数加/负数减）</Label><Input type="number" value={batchDelta} onChange={(e) => setBatchDelta(Number(e.target.value))} /></div>
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

      {/* Edit/Create Sheet */}
      <ProductEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        platforms={platforms}
        onSaved={() => { setSheetOpen(false); loadData(); }}
      />
    </div>
  );
}

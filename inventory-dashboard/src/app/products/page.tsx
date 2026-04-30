"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImage, fetchWarehouses, fetchPlatforms } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Search, Upload, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const defaultForm = {
  sku: "", title: "", onlineSpec: "", beijingId: "", originalPrice: 0, discountPrice: 0, costPrice: 0,
  weight: "", categoryL1: "", categoryL2: "", mainImage: "", shippingSampleImage: "", link: "",
  purchaseSpec: "", jdSku: "", packagingMaterial: "", packagingPrice: 0, description: "",
  unit: "束", safetyStock: 0,
};

const platformNames: Record<string, string> = { meituan: "美团闪购", eleme: "饿了么零售", jddj: "京东到家", douyin: "抖音小时达" };

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [warehouses, setWarehouses] = useState<Record<string, unknown>[]>([]);
  const [platforms, setPlatforms] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Category tree
  const [selectedL1, setSelectedL1] = useState<string | null>(null);
  const [selectedL2, setSelectedL2] = useState<string | null>(null);
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncTargets, setSyncTargets] = useState<Set<string>>(new Set());

  // Delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Compute category tree
  const categoryTree = useMemo(() => {
    const map = new Map<string, { l2s: Map<string, number>; total: number }>();
    products.forEach((p) => {
      const l1 = p.categoryL1 as string;
      if (!map.has(l1)) map.set(l1, { l2s: new Map(), total: 0 });
      const entry = map.get(l1)!;
      entry.total++;
      if (p.categoryL2) {
        entry.l2s.set(p.categoryL2 as string, (entry.l2s.get(p.categoryL2 as string) || 0) + 1);
      }
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title as string)?.toLowerCase().includes(s) || (p.sku as string)?.toLowerCase().includes(s)
      );
    }
    if (selectedL1) {
      filtered = filtered.filter((p) => p.categoryL1 === selectedL1);
      if (selectedL2) {
        filtered = filtered.filter((p) => p.categoryL2 === selectedL2);
      }
    }
    return filtered;
  }, [products, search, selectedL1, selectedL2]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try { setProducts(await fetchProducts()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) { loadProducts(); fetchWarehouses().then(setWarehouses).catch(() => {}); fetchPlatforms().then(setPlatforms).catch(() => {}); }
  }, [authLoading, user, router, loadProducts]);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setSyncTargets(new Set()); setSheetOpen(true); };

  const openEdit = (p: Record<string, unknown>) => {
    setEditing(p);
    setForm({
      sku: (p.sku as string) || "", title: (p.title as string) || "", onlineSpec: (p.onlineSpec as string) || "",
      beijingId: (p.beijingId as string) || "", originalPrice: (p.originalPrice as number) || 0,
      discountPrice: (p.discountPrice as number) || 0, costPrice: (p.costPrice as number) || 0,
      weight: p.weight ? String(p.weight) : "", categoryL1: (p.categoryL1 as string) || "",
      categoryL2: (p.categoryL2 as string) || "", mainImage: (p.mainImage as string) || "",
      shippingSampleImage: (p.shippingSampleImage as string) || "", link: (p.link as string) || "",
      purchaseSpec: (p.purchaseSpec as string) || "", jdSku: (p.jdSku as string) || "",
      packagingMaterial: (p.packagingMaterial as string) || "", packagingPrice: (p.packagingPrice as number) || 0,
      description: (p.description as string) || "", unit: (p.unit as string) || "束",
      safetyStock: (p.safetyStock as number) || 0,
    });
    // Pre-select platforms that are connected
    const links = (p.platformLinks as Record<string, unknown>[]) || [];
    const connected = links.filter((l) => (l.platform as Record<string, unknown>)?.status === "connected");
    setSyncTargets(new Set(connected.map((l) => (l.platform as Record<string, unknown>).id as string)));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.sku || !form.title || !form.categoryL1) { toast.error("请填写必填字段"); return; }
    setSaving(true);
    try {
      const payload = { ...form, weight: form.weight ? Number(form.weight) : null };
      if (editing) {
        await updateProduct(editing.id as string, payload);
        // Trigger sync for selected platforms
        if (syncTargets.size > 0) {
          for (const platId of syncTargets) {
            try {
              await fetch("/api/sync-tasks/trigger", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platformId: platId }),
              });
            } catch { /* sync failure shown in status */ }
          }
          toast.success("已保存，同步已触发");
        } else { toast.success("已更新"); }
      } else {
        await createProduct(payload);
        toast.success("已创建");
      }
      setSheetOpen(false); loadProducts();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      for (const id of selected) await deleteProduct(id);
      toast.success(`已删除 ${selected.size} 个`); setSelected(new Set()); setDeleteOpen(false); loadProducts();
    } catch { toast.error("删除失败"); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(file); setForm((f) => ({ ...f, [field]: url })); toast.success("上传成功"); }
    catch { toast.error("上传失败"); }
    finally { setUploading(false); }
  };

  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: Category Tree */}
      <aside className="w-[220px] border-r bg-white p-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">商品分类</h3>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedL1(null); setSelectedL2(null); }}>
            全部 ({products.length})
          </Button>
        </div>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-1">
            {Array.from(categoryTree.entries()).map(([l1, data]) => (
              <div key={l1}>
                <button
                  onClick={() => {
                    setSelectedL1(l1); setSelectedL2(null);
                    setExpandedL1((prev) => { const n = new Set(prev); n.has(l1) ? n.delete(l1) : n.add(l1); return n; });
                  }}
                  className={cn(
                    "flex items-center gap-1 w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted transition-colors",
                    selectedL1 === l1 && !selectedL2 && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {data.l2s.size > 0 ? (
                    <ChevronRight className={cn("h-3 w-3 transition-transform", expandedL1.has(l1) && "rotate-90")} />
                  ) : <span className="w-3" />}
                  {expandedL1.has(l1) ? <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> : <Folder className="h-3.5 w-3.5 text-amber-500" />}
                  <span className="flex-1 truncate">{l1}</span>
                  <span className="text-xs text-muted-foreground">{data.total}</span>
                </button>
                {expandedL1.has(l1) && (
                  <div className="ml-5 space-y-0.5">
                    {Array.from(data.l2s.entries()).map(([l2, count]) => (
                      <button
                        key={l2}
                        onClick={() => { setSelectedL1(l1); setSelectedL2(l2); }}
                        className={cn(
                          "block w-full text-left text-xs py-1 px-2 rounded hover:bg-muted transition-colors",
                          selectedL2 === l2 && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {l2} <span className="text-muted-foreground">({count})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Right: Product Table */}
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">商品管理</h1>
            <p className="text-xs text-muted-foreground">
              {selectedL1 ? `${selectedL1}${selectedL2 ? ` / ${selectedL2}` : ""}` : "全部分类"} · {filteredProducts.length} 个商品
            </p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />删除 ({selected.size})</Button>}
            <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />新增商品</Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索标题 / SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"><Checkbox checked={selected.size === filteredProducts.length && filteredProducts.length > 0} onCheckedChange={() => selected.size === filteredProducts.length ? setSelected(new Set()) : setSelected(new Set(filteredProducts.map((p) => p.id as string)))} /></TableHead>
                  <TableHead className="w-[90px]">SKU</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-[90px]">分类</TableHead>
                  <TableHead className="text-right w-[60px]">原价</TableHead>
                  <TableHead className="text-right w-[60px]">售价</TableHead>
                  <TableHead className="text-right w-[60px]">进价</TableHead>
                  <TableHead className="w-[100px]">平台状态</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">暂无商品</TableCell></TableRow>
                ) : (
                  filteredProducts.map((p) => {
                    const links = (p.platformLinks as Record<string, unknown>[]) || [];
                    return (
                      <TableRow key={p.id as string}>
                        <TableCell><Checkbox checked={selected.has(p.id as string)} onCheckedChange={() => { const n = new Set(selected); n.has(p.id as string) ? n.delete(p.id as string) : n.add(p.id as string); setSelected(n); }} /></TableCell>
                        <TableCell className="font-mono text-xs">{p.sku as string}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={p.title as string}>{p.title as string}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{p.categoryL1 as string}</Badge></TableCell>
                        <TableCell className="text-right text-xs">¥{(p.originalPrice as number)?.toFixed(0)}</TableCell>
                        <TableCell className="text-right text-xs font-medium text-primary">¥{(p.discountPrice as number)?.toFixed(0)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">¥{(p.costPrice as number)?.toFixed(0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 flex-wrap">
                            {platforms.filter((pl) => pl.status === "connected").map((pl) => {
                              const link = links.find((l) => (l.platform as Record<string, unknown>)?.id === pl.id);
                              const status = (link?.syncStatus as string) || "unbound";
                              return (
                                <Tooltip key={pl.id as string}>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${status === "synced" ? "bg-green-500" : status === "failed" ? "bg-red-500" : status === "pending" ? "bg-yellow-500" : "bg-gray-300"}`} />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {platformNames[pl.code as string] || pl.name as string}: {status === "synced" ? "已同步" : status === "failed" ? link?.errorMessage || "同步异常" : status === "pending" ? "待同步" : "未绑定"}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Sheet (Side Panel) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-[550px] w-full p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 pt-6 pb-2">
              <SheetTitle>{editing ? "编辑商品" : "新增商品"}</SheetTitle>
              <SheetDescription>{editing ? "修改商品信息并同步到平台" : "填写商品基本信息"}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 px-6">
              <div className="grid gap-3 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">SKU *</Label><Input className="h-8 text-sm" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!editing} /></div>
                  <div><Label className="text-xs">北京编号</Label><Input className="h-8 text-sm" value={form.beijingId} onChange={(e) => setForm({ ...form, beijingId: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">一级分类 *</Label><Input className="h-8 text-sm" value={form.categoryL1} onChange={(e) => setForm({ ...form, categoryL1: e.target.value })} /></div>
                  <div><Label className="text-xs">二级分类</Label><Input className="h-8 text-sm" value={form.categoryL2} onChange={(e) => setForm({ ...form, categoryL2: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-xs">原价</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">售价</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">进价</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">耗材价格</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.packagingPrice} onChange={(e) => setForm({ ...form, packagingPrice: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">单位</Label><Input className="h-8 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                  <div><Label className="text-xs">重量(g)</Label><Input className="h-8 text-sm" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
                  <div><Label className="text-xs">安全库存</Label><Input className="h-8 text-sm" type="number" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: Number(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">包装耗材</Label><Input className="h-8 text-sm" value={form.packagingMaterial} onChange={(e) => setForm({ ...form, packagingMaterial: e.target.value })} /></div>
                  <div><Label className="text-xs">1688链接</Label><Input className="h-8 text-sm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">线上规格</Label><Input className="h-8 text-sm" value={form.onlineSpec} onChange={(e) => setForm({ ...form, onlineSpec: e.target.value })} /></div>
                  <div><Label className="text-xs">购买规格</Label><Input className="h-8 text-sm" value={form.purchaseSpec} onChange={(e) => setForm({ ...form, purchaseSpec: e.target.value })} /></div>
                </div>
                <div><Label className="text-xs">京东礼定SKU</Label><Input className="h-8 text-sm" value={form.jdSku} onChange={(e) => setForm({ ...form, jdSku: e.target.value })} /></div>

                {/* Images */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">商品主图</Label>
                    <div className="flex items-center gap-2 mt-1">{form.mainImage && <img src={form.mainImage} className="h-10 w-10 rounded object-cover" />}
                      <label className="cursor-pointer rounded border px-2 py-1 text-xs hover:bg-muted"><Upload className="inline h-3 w-3 mr-1" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "mainImage")} /></label>
                    </div>
                  </div>
                  <div><Label className="text-xs">出库样图</Label>
                    <div className="flex items-center gap-2 mt-1">{form.shippingSampleImage && <img src={form.shippingSampleImage} className="h-10 w-10 rounded object-cover" />}
                      <label className="cursor-pointer rounded border px-2 py-1 text-xs hover:bg-muted"><Upload className="inline h-3 w-3 mr-1" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "shippingSampleImage")} /></label>
                    </div>
                  </div>
                </div>

                {/* Sync targets (edit mode only) */}
                {editing && (
                  <div className="border-t pt-3 mt-2">
                    <Label className="text-xs font-medium mb-2 block">同步到平台（保存后自动推送）</Label>
                    <div className="flex flex-wrap gap-3">
                      {platforms.map((plat) => {
                        const links = (editing.platformLinks as Record<string, unknown>[]) || [];
                        const link = links.find((l) => (l.platform as Record<string, unknown>)?.id === plat.id);
                        const status = link?.syncStatus as string;
                        return (
                          <label key={plat.id as string} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={syncTargets.has(plat.id as string)}
                              onCheckedChange={() => {
                                const n = new Set(syncTargets);
                                n.has(plat.id as string) ? n.delete(plat.id as string) : n.add(plat.id as string);
                                setSyncTargets(n);
                              }}
                              disabled={plat.status !== "connected"}
                            />
                            <span className="text-xs">{platformNames[plat.code as string] || plat.name as string}</span>
                            {status === "failed" && <Badge variant="destructive" className="text-[10px] px-1">异常</Badge>}
                            {status === "synced" && <span className="w-2 h-2 rounded-full bg-green-500" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <SheetFooter className="px-6 pb-6 pt-2 border-t">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editing ? "保存并同步" : "创建"}</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除选中的 {selected.size} 个商品吗？</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button><Button variant="destructive" onClick={handleDelete}>确认删除</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

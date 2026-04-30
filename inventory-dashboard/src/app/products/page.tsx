"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchProducts, createProduct, updateProduct, deleteProduct, uploadImage, fetchWarehouses } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Search, Upload } from "lucide-react";

const defaultForm = {
  sku: "", title: "", onlineSpec: "", beijingId: "", originalPrice: 0, discountPrice: 0, costPrice: 0,
  weight: "", categoryL1: "", categoryL2: "", mainImage: "", shippingSampleImage: "", link: "",
  purchaseSpec: "", jdSku: "", packagingMaterial: "", packagingPrice: 0, description: "",
  unit: "束", safetyStock: 0,
};

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [warehouses, setWarehouses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);

  const categories = Array.from(new Set(products.map((p) => p.categoryL1 as string)));

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProducts({ search: search || undefined, category: catFilter === "all" ? undefined : catFilter });
      setProducts(data);
    } finally { setLoading(false); }
  }, [search, catFilter]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) { loadProducts(); fetchWarehouses().then(setWarehouses).catch(() => {}); }
  }, [authLoading, user, router, loadProducts]);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setDialogOpen(true); };
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.sku || !form.title || !form.categoryL1) { toast.error("请填写必填字段（SKU/标题/一级分类）"); return; }
    setSaving(true);
    try {
      const payload = { ...form, weight: form.weight ? Number(form.weight) : null };
      if (editing) { await updateProduct(editing.id as string, payload); toast.success("已更新"); }
      else { await createProduct(payload); toast.success("已创建"); }
      setDialogOpen(false); loadProducts();
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">商品管理</h1><p className="text-sm text-muted-foreground">管理商品信息 · 多仓库库存 · 平台同步</p></div>
        <div className="flex gap-2">
          {selected.size > 0 && <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1 h-4 w-4" />删除 ({selected.size})</Button>}
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />新增商品</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="搜索标题 / SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" /></div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="全部分类" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部分类</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"><Checkbox checked={selected.size === products.length && products.length > 0} onCheckedChange={() => selected.size === products.length ? setSelected(new Set()) : setSelected(new Set(products.map((p) => p.id as string)))} /></TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>分类</TableHead>
                <TableHead className="text-right">原价</TableHead>
                <TableHead className="text-right">售价</TableHead>
                <TableHead className="text-right">进价</TableHead>
                <TableHead className="text-right">库存</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                : products.length === 0 ? <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">暂无商品</TableCell></TableRow>
                  : products.map((p) => (
                    <TableRow key={p.id as string}>
                      <TableCell><Checkbox checked={selected.has(p.id as string)} onCheckedChange={() => { const n = new Set(selected); n.has(p.id as string) ? n.delete(p.id as string) : n.add(p.id as string); setSelected(n); }} /></TableCell>
                      <TableCell className="font-mono text-xs">{p.sku as string}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate" title={p.title as string}>{p.title as string}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{p.categoryL1 as string}{p.categoryL2 ? ` / ${p.categoryL2}` : ""}</Badge></TableCell>
                      <TableCell className="text-right text-sm">¥{(p.originalPrice as number)?.toFixed(0)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-primary">¥{(p.discountPrice as number)?.toFixed(0)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">¥{(p.costPrice as number)?.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{(p as { currentStock?: number }).currentStock ?? "-"}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
          <DialogHeader><DialogTitle>{editing ? "编辑商品" : "新增商品"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!editing} /></div>
              <div><Label>北京编号</Label><Input value={form.beijingId} onChange={(e) => setForm({ ...form, beijingId: e.target.value })} /></div>
            </div>
            <div><Label>商品标题 *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>一级分类 *</Label><Input value={form.categoryL1} onChange={(e) => setForm({ ...form, categoryL1: e.target.value })} placeholder="如：玩偶花束手办花束" /></div>
              <div><Label>二级分类</Label><Input value={form.categoryL2} onChange={(e) => setForm({ ...form, categoryL2: e.target.value })} placeholder="如：大号手办花束" /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>原价</Label><Input type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })} /></div>
              <div><Label>售价</Label><Input type="number" step="0.01" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: Number(e.target.value) })} /></div>
              <div><Label>进价</Label><Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} /></div>
              <div><Label>耗材价格</Label><Input type="number" step="0.01" value={form.packagingPrice} onChange={(e) => setForm({ ...form, packagingPrice: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>单位</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div><Label>重量(g)</Label><Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></div>
              <div><Label>安全库存</Label><Input type="number" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: Number(e.target.value) })} /></div>
            </div>
            <div><Label>线上规格</Label><Input value={form.onlineSpec} onChange={(e) => setForm({ ...form, onlineSpec: e.target.value })} /></div>
            <div><Label>购买规格</Label><Input value={form.purchaseSpec} onChange={(e) => setForm({ ...form, purchaseSpec: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>包装耗材</Label><Input value={form.packagingMaterial} onChange={(e) => setForm({ ...form, packagingMaterial: e.target.value })} /></div>
              <div><Label>1688链接</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
            </div>
            <div><Label>京东礼定SKU</Label><Input value={form.jdSku} onChange={(e) => setForm({ ...form, jdSku: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>商品主图</Label>
                <div className="flex items-center gap-2">{form.mainImage && <img src={form.mainImage} className="h-12 w-12 rounded object-cover" />}
                  <label className="cursor-pointer rounded border px-2 py-1 text-xs hover:bg-muted"><Upload className="inline h-3 w-3 mr-1" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "mainImage")} /></label>
                </div>
              </div>
              <div><Label>出库样图</Label>
                <div className="flex items-center gap-2">{form.shippingSampleImage && <img src={form.shippingSampleImage} className="h-12 w-12 rounded object-cover" />}
                  <label className="cursor-pointer rounded border px-2 py-1 text-xs hover:bg-muted"><Upload className="inline h-3 w-3 mr-1" />上传<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "shippingSampleImage")} /></label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editing ? "保存" : "创建"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent><DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除选中的 {selected.size} 个商品吗？</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button><Button variant="destructive" onClick={handleDelete}>确认删除</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

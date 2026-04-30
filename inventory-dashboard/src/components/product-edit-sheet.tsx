"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadImage, createProduct, updateProduct } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface PlatformItem {
  id: string; name: string; code: string; status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Record<string, unknown> | null;
  platforms: PlatformItem[];
  onSaved: () => void;
}

const platformNames: Record<string, string> = { meituan: "美团", eleme: "饿了么", jddj: "京东", douyin: "抖音" };

const defaultForm = {
  sku: "", title: "", onlineSpec: "", beijingId: "", originalPrice: 0, discountPrice: 0, costPrice: 0,
  weight: "", categoryL1: "", categoryL2: "", mainImage: "", shippingSampleImage: "", link: "",
  purchaseSpec: "", jdSku: "", packagingMaterial: "", packagingPrice: 0, description: "", unit: "束", safetyStock: 0,
};

export function ProductEditSheet({ open, onOpenChange, editing, platforms, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [syncTargets, setSyncTargets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        sku: editing.sku as string, title: editing.title as string, onlineSpec: (editing.onlineSpec as string) || "",
        beijingId: (editing.beijingId as string) || "", originalPrice: editing.originalPrice as number,
        discountPrice: editing.discountPrice as number, costPrice: editing.costPrice as number,
        weight: editing.weight ? String(editing.weight) : "", categoryL1: editing.categoryL1 as string,
        categoryL2: (editing.categoryL2 as string) || "", mainImage: (editing.mainImage as string) || "",
        shippingSampleImage: (editing.shippingSampleImage as string) || "", link: (editing.link as string) || "",
        purchaseSpec: (editing.purchaseSpec as string) || "", jdSku: (editing.jdSku as string) || "",
        packagingMaterial: (editing.packagingMaterial as string) || "", packagingPrice: editing.packagingPrice as number,
        description: (editing.description as string) || "", unit: editing.unit as string, safetyStock: editing.safetyStock as number,
      });
      setSyncTargets(new Set(platforms.filter((p) => p.status === "connected").map((p) => p.id)));
    } else {
      setForm(defaultForm);
      setSyncTargets(new Set());
    }
  }, [open, editing, platforms]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setForm((prev) => ({ ...prev, [field]: url }));
      toast.success("上传成功");
    } catch { toast.error("上传失败"); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.sku || !form.title || !form.categoryL1) { toast.error("请填写必填字段"); return; }
    setSaving(true);
    try {
      const payload = { ...form, weight: form.weight ? Number(form.weight) : null };
      if (editing) {
        await updateProduct(editing.id as string, payload);
        for (const pid of syncTargets) {
          await fetch("/api/sync-tasks/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformId: pid }) }).catch(() => {});
        }
        toast.success(syncTargets.size > 0 ? "已保存并触发同步" : "已更新");
      } else {
        await createProduct(payload);
        toast.success("已创建");
      }
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || uploading}>{saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}{editing ? "保存" : "创建"}</Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, fetchWarehouses, fetchProducts } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, ExternalLink, Truck } from "lucide-react";

interface OrderItem {
  id: string; productId: string; sku: string; quantity: number;
  costPrice: number; link?: string; product: { title: string; sku: string };
}

interface PurchaseOrder {
  id: string; warehouseId: string; status: string; note?: string;
  damageDetail?: string; createdAt: string; arrivedAt?: string;
  warehouse: { name: string; code: string };
  items: OrderItem[];
}

interface Product {
  id: string; sku: string; title: string; costPrice: number; link?: string;
}

export default function PurchaseOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWh, setSelectedWh] = useState("");
  const [note, setNote] = useState("");
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  // Arrival dialog
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [arrivalOrder, setArrivalOrder] = useState<PurchaseOrder | null>(null);
  const [damageMap, setDamageMap] = useState<Record<string, number>>({});
  const [arrivalNote, setArrivalNote] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, whData, prodData] = await Promise.all([
        fetchPurchaseOrders({ status: filterStatus }),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setOrders(ordersData);
      setWarehouses(whData);
      setProducts(prodData);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) loadData();
  }, [authLoading, user, router, loadData]);

  const handleCreate = async () => {
    if (!selectedWh || orderItems.length === 0) { toast.error("请选择仓库和商品"); return; }
    setSaving(true);
    try {
      await createPurchaseOrder({ warehouseId: selectedWh, note, items: orderItems });
      toast.success("进货单已创建");
      setCreateOpen(false); setSelectedWh(""); setNote(""); setOrderItems([]); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "创建失败"); }
    finally { setSaving(false); }
  };

  const handleArrival = async () => {
    if (!arrivalOrder) return;
    try {
      const damageDetail = arrivalOrder.items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        quantity: damageMap[item.id] || 0,
      })).filter((d) => d.quantity > 0);

      await updatePurchaseOrder(arrivalOrder.id, { status: "arrived", damageDetail, note: arrivalNote });
      toast.success("已确认到货，库存已自动添加");
      setArrivalOpen(false); loadData();
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
  };

  const handleCancel = async (id: string) => {
    try { await deletePurchaseOrder(id); toast.success("已取消"); loadData(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "取消失败"); }
  };

  const openArrival = (order: PurchaseOrder) => {
    setArrivalOrder(order);
    setDamageMap({});
    setArrivalNote(order.note || "");
    setArrivalOpen(true);
  };

  if (authLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!user) return null;

  const statusLabel: Record<string, string> = { pending: "待收货", arrived: "已到货", cancelled: "已取消" };
  const statusColor: Record<string, string> = { pending: "bg-yellow-100 text-yellow-700", arrived: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500" };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">进货管理</h1><p className="text-sm text-muted-foreground">创建进货单 · 确认到货自动加库存</p></div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />创建进货单</Button>
      </div>

      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待收货</TabsTrigger>
          <TabsTrigger value="arrived">已到货</TabsTrigger>
          <TabsTrigger value="cancelled">已取消</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单编号</TableHead>
                <TableHead>仓库</TableHead>
                <TableHead>商品数</TableHead>
                <TableHead>总数量</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>到货时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">暂无进货单</TableCell></TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">#{o.id.slice(-8).toUpperCase()}</TableCell>
                    <TableCell><Badge variant="outline">{o.warehouse.name}</Badge></TableCell>
                    <TableCell>{o.items.length}</TableCell>
                    <TableCell>{o.items.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[o.status]}>{statusLabel[o.status]}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.arrivedAt ? new Date(o.arrivedAt).toLocaleString("zh-CN") : "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {o.status === "pending" && (
                          <>
                            <Button size="sm" className="h-7 text-xs" onClick={() => openArrival(o)}>确认到货</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => handleCancel(o.id)}>取消</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Order Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] w-full p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 pt-6 pb-2">
              <SheetTitle>创建进货单</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 pb-4">
                <div>
                  <Label className="text-xs">进货仓库 *</Label>
                  <Select value={selectedWh} onValueChange={setSelectedWh}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="选择仓库" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">商品明细</Label>
                  {orderItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    return (
                      <div key={idx} className="flex gap-2 items-end mb-2 pb-2 border-b">
                        <div className="flex-1">
                          <Select value={item.productId} onValueChange={(v) => { const n = [...orderItems]; n[idx].productId = v; setOrderItems(n); }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选SKU" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.title?.slice(0, 20)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {prod && (
                            <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                              <span>进价: ¥{prod.costPrice}</span>
                              {prod.link && <a href={prod.link} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5"><ExternalLink className="h-2.5 w-2.5" />进货链接</a>}
                            </div>
                          )}
                        </div>
                        <div className="w-16"><Input className="h-8 text-xs" type="number" min={1} value={item.quantity} onChange={(e) => { const n = [...orderItems]; n[idx].quantity = Number(e.target.value); setOrderItems(n); }} /></div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => setOrderItems([...orderItems, { productId: "", quantity: 1 }])}>
                    <Plus className="mr-1 h-3 w-3" />添加商品
                  </Button>
                </div>

                {orderItems.length > 0 && (
                  <div>
                    <Label className="text-xs mb-1 block">汇总</Label>
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-xs">SKU</TableHead><TableHead className="text-xs text-right">进价</TableHead><TableHead className="text-xs text-right">数量</TableHead><TableHead className="text-xs text-right">小计</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {orderItems.map((item, idx) => {
                          const prod = products.find((p) => p.id === item.productId);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-mono">{prod?.sku || "-"}</TableCell>
                              <TableCell className="text-xs text-right">¥{(prod?.costPrice || 0).toFixed(0)}</TableCell>
                              <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                              <TableCell className="text-xs text-right">¥{((prod?.costPrice || 0) * item.quantity).toFixed(0)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div><Label className="text-xs">备注</Label><Textarea className="mt-1 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="进货备注" /></div>
              </div>
            </ScrollArea>
            <SheetFooter className="px-6 pb-6 pt-2 border-t">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}创建进货单</Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* Arrival Confirmation Dialog */}
      <Dialog open={arrivalOpen} onOpenChange={setArrivalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>确认到货</DialogTitle><DialogDescription>
            {arrivalOrder && <span>订单 #{arrivalOrder.id.slice(-8).toUpperCase()} · {arrivalOrder.warehouse.name}</span>}
          </DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <Table>
              <TableHeader><TableRow><TableHead>商品</TableHead><TableHead className="text-right">数量</TableHead><TableHead className="text-right">货损</TableHead></TableRow></TableHeader>
              <TableBody>
                {arrivalOrder?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.product.title}<br /><span className="text-xs text-muted-foreground">{item.sku}</span></TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <Input className="h-7 w-16 text-xs inline-block" type="number" min={0} max={item.quantity}
                        value={damageMap[item.id] || 0}
                        onChange={(e) => setDamageMap({ ...damageMap, [item.id]: Number(e.target.value) })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div><Label className="text-xs">到货说明</Label><Textarea className="mt-1 text-sm" value={arrivalNote} onChange={(e) => setArrivalNote(e.target.value)} placeholder="货损说明（选填）" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArrivalOpen(false)}>取消</Button>
            <Button onClick={handleArrival}>确认到货（自动加库存）</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

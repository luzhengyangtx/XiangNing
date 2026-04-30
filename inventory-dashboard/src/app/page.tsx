"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatsCards } from "@/components/stats-cards";
import { useAuth } from "@/lib/auth-context";
import type { InventoryItem } from "@/lib/api";
import { fetchInventory, adjustStock, adjustStockBatch } from "@/lib/api";
import { toast } from "sonner";
import {
  Search,
  ArrowUpDown,
  Plus,
  Minus,
  Loader2,
  RotateCw,
} from "lucide-react";

const platformLabel: Record<string, string> = {
  synced: "正常",
  pending: "待同步",
  failed: "异常",
};
const platformColor: Record<string, string> = {
  synced: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

const platforms = [
  { key: "meituan", label: "美团闪购" },
  { key: "eleme", label: "饿了么" },
  { key: "jddj", label: "京东到家" },
];

function StatusBadge({ status }: { status?: string }) {
  const s = status || "pending";
  return (
    <Badge variant="outline" className={platformColor[s] || "bg-gray-100 text-gray-500"}>
      {platformLabel[s] || "未绑定"}
    </Badge>
  );
}

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

  // Batch selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDelta, setBatchDelta] = useState(0);
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchInventory({
        search: search || undefined,
        category: category === "all" ? undefined : category,
        sortCol,
        sortDir,
      });
      setData(result.items);
      setCategories(result.categories);
      setTotalCount(result.totalCount);
      setLowStockCount(result.lowStockCount);
      setSyncFailures(result.syncFailures);
    } finally {
      setLoading(false);
    }
  }, [search, category, sortCol, sortDir]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadData();
  }, [authLoading, user, router, loadData]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const handleAdjust = async (productId: string, delta: number) => {
    setAdjusting(productId);
    try {
      const result = await adjustStock(productId, delta);
      setData((prev) =>
        prev.map((item) =>
          item.id === productId
            ? { ...item, currentStock: result.currentStock }
            : item
        )
      );
      toast.success(delta > 0 ? `库存 +${delta}` : `库存 ${delta}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setAdjusting(null);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((i) => i.id)));
    }
  };

  const handleBatchAdjust = async () => {
    if (batchDelta === 0) return;
    setBatchLoading(true);
    try {
      const items = Array.from(selected).map((productId) => ({
        productId,
        delta: batchDelta,
      }));
      const result = await adjustStockBatch(items, batchReason);
      const errors = result.results.filter((r) => r.error);
      if (errors.length > 0) {
        toast.warning(`部分操作失败: ${errors.length} 项`);
      } else {
        toast.success(`批量操作完成: ${items.length} 项`);
      }
      setBatchOpen(false);
      setSelected(new Set());
      setBatchDelta(0);
      setBatchReason("");
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "批量操作失败");
    } finally {
      setBatchLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">库存看板</h1>
        <p className="text-sm text-muted-foreground">实时监控各平台库存状态</p>
      </div>

      <StatsCards
        totalProducts={totalCount}
        lowStockCount={lowStockCount}
        syncFailures={syncFailures}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>商品库存列表</CardTitle>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RotateCw className="mr-1 h-3 w-3" />
              刷新
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索商品名称 / SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <Button variant="default" size="sm" onClick={() => setBatchOpen(true)}>
                批量操作 ({selected.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selected.size === data.length && data.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[190px]">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("name")}>
                    商品名称 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[110px]">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("sku")}>
                    SKU <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[70px]">分类</TableHead>
                <TableHead className="w-[85px] text-right">
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("currentStock")}>
                    库存 <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                {platforms.map((p) => (
                  <TableHead key={p.key} className="w-[95px]">{p.label}</TableHead>
                ))}
                <TableHead className="w-[130px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    未找到匹配的商品
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id} className={selected.has(item.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.currentStock < item.safetyStock ? "font-bold text-red-600" : ""}>
                        {item.currentStock}
                      </span>
                      <span className="text-xs text-muted-foreground"> / {item.safetyStock}</span>
                    </TableCell>
                    {platforms.map((p) => (
                      <TableCell key={p.key}>
                        <StatusBadge status={item.platformStatus?.[p.key]} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{item.currentStock}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={adjusting === item.id} onClick={() => handleAdjust(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Batch adjust dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量调整库存</DialogTitle>
            <DialogDescription>
              已选择 {selected.size} 个商品，输入调整数量和原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>调整数量（正数加库存，负数减库存）</Label>
              <Input
                type="number"
                value={batchDelta}
                onChange={(e) => setBatchDelta(Number(e.target.value))}
                placeholder="例如: 10 或 -5"
              />
            </div>
            <div className="space-y-2">
              <Label>操作原因</Label>
              <Textarea
                value={batchReason}
                onChange={(e) => setBatchReason(e.target.value)}
                placeholder="例如：进货入库"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button onClick={handleBatchAdjust} disabled={batchDelta === 0 || batchLoading}>
              {batchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

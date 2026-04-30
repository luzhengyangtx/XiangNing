"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { StatsCards } from "@/components/stats-cards";
import type { InventoryItem } from "@/lib/api";
import { fetchInventory, adjustStock } from "@/lib/api";
import { Search, ArrowUpDown, Plus, Minus, Loader2 } from "lucide-react";

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
    loadData();
  }, [loadData]);

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
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setAdjusting(null);
    }
  };

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
          <CardTitle>商品库存列表</CardTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    商品名称
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[110px]">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("sku")}
                  >
                    SKU
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[80px]">分类</TableHead>
                <TableHead className="w-[90px] text-right">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("currentStock")}
                  >
                    当前库存
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                {platforms.map((p) => (
                  <TableHead key={p.key} className="w-[100px]">
                    {p.label}
                  </TableHead>
                ))}
                <TableHead className="w-[140px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    未找到匹配的商品
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.currentStock < item.safetyStock
                            ? "font-bold text-red-600"
                            : ""
                        }
                      >
                        {item.currentStock}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        / {item.safetyStock}
                      </span>
                    </TableCell>
                    {platforms.map((p) => (
                      <TableCell key={p.key}>
                        <StatusBadge status={item.platformStatus?.[p.key]} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={adjusting === item.id}
                          onClick={() => handleAdjust(item.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {item.currentStock}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={adjusting === item.id}
                          onClick={() => handleAdjust(item.id, 1)}
                        >
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
    </div>
  );
}

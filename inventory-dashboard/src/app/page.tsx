"use client";

import { useState } from "react";
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
import {
  mockInventory,
  platformLabel,
  platformColor,
  type InventoryItem,
  type PlatformStatus,
} from "@/lib/mock-data";
import { Search, ArrowUpDown, Plus, Minus } from "lucide-react";

const platforms = [
  { key: "meituan" as const, label: "美团闪购" },
  { key: "eleme" as const, label: "饿了么" },
  { key: "jddj" as const, label: "京东到家" },
];

function StatusBadge({ status }: { status: PlatformStatus }) {
  return (
    <Badge variant="outline" className={platformColor[status]}>
      {platformLabel[status]}
    </Badge>
  );
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortCol, setSortCol] = useState<keyof InventoryItem | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [data, setData] = useState(mockInventory);

  const categories = Array.from(new Set(mockInventory.map((i) => i.category)));

  let filtered = data.filter((item) => {
    const matchSearch =
      item.name.includes(search) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || item.category === category;
    return matchSearch && matchCategory;
  });

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  const handleSort = (col: keyof InventoryItem) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const adjustStock = (id: string, delta: number) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, currentStock: Math.max(0, item.currentStock + delta) }
          : item
      )
    );
  };

  const lowStockCount = data.filter((i) => i.currentStock < i.safetyStock).length;
  const syncFailures = data.filter(
    (i) =>
      i.meituanStatus === "error" ||
      i.elemeStatus === "error" ||
      i.jddjStatus === "error"
  ).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">库存看板</h1>
        <p className="text-sm text-muted-foreground">实时监控各平台库存状态</p>
      </div>

      <StatsCards
        totalProducts={data.length}
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    未找到匹配的商品
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
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
                    <TableCell>
                      <StatusBadge status={item.meituanStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.elemeStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.jddjStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => adjustStock(item.id, -1)}
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
                          onClick={() => adjustStock(item.id, 1)}
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

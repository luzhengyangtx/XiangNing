import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle } from "lucide-react";

interface StatsCardsProps {
  totalProducts: number;
  lowStockCount: number;
  syncFailures: number;
}

export function StatsCards({
  totalProducts,
  lowStockCount,
  syncFailures,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">总商品数</p>
            <p className="text-2xl font-bold">{totalProducts}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">低库存商品</p>
            <p className="text-2xl font-bold">{lowStockCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">今日同步失败</p>
            <p className="text-2xl font-bold">{syncFailures}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

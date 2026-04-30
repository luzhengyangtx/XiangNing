"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/lib/api";
import { toggleShelvesStatus } from "@/lib/api";
import { toast } from "sonner";
import { Minus, Plus, Pencil, Package } from "lucide-react";

interface PlatformInfo {
  id: string; code: string; name: string;
}

interface Props {
  item: InventoryItem;
  platforms: PlatformInfo[];
  activeWhId: string;
  selected: boolean;
  onToggleSelect: () => void;
  onAdjust: (productId: string, delta: number) => void;
  onEdit: (item: InventoryItem) => void;
  onShelvesChange: () => void;
}

const platformNames: Record<string, string> = { meituan: "美团", eleme: "饿了么", jddj: "京东", douyin: "抖音" };
const platformColors: Record<string, string> = { meituan: "#FFD100", eleme: "#0085FF", jddj: "#E2231A", douyin: "#111" };

export function ProductCard({ item, platforms, activeWhId, selected, onToggleSelect, onAdjust, onEdit, onShelvesChange }: Props) {
  const ws = item.warehouseStocks.find((w) => w.warehouseId === activeWhId);
  const stock = ws?.stock ?? 0;
  const isLow = stock < item.safetyStock;
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggleShelves = async (platformId: string, current: string) => {
    setToggling(platformId);
    try {
      await toggleShelvesStatus(item.id, platformId, current === "on" ? "off" : "on");
      onShelvesChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally { setToggling(null); }
  };

  const connectedPlatforms = platforms.filter((p) => {
    const ps = item.platformStatus[p.code];
    return ps; // Has a platform link record
  });

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors",
      selected && "bg-primary/5",
      isLow && "bg-red-50/30"
    )}>
      {/* Checkbox */}
      <button
        className={cn("mt-3 w-4 h-4 rounded border-2 shrink-0 transition-colors",
          selected ? "bg-primary border-primary" : "border-gray-300 hover:border-primary"
        )}
        onClick={onToggleSelect}
      >
        {selected && <span className="text-white text-[10px] leading-none flex items-center justify-center">✓</span>}
      </button>

      {/* Image */}
      <div className="w-[52px] h-[52px] rounded-md bg-muted shrink-0 flex items-center justify-center overflow-hidden">
        {item.mainImage ? (
          <img src={item.mainImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-medium truncate">{item.title}</h4>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span className="font-mono">{item.sku}</span>
              <Badge variant="secondary" className="text-[10px] h-4">{item.categoryL1}</Badge>
              {item.categoryL2 && <span className="text-[10px]">{item.categoryL2}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs">
          <span className="text-muted-foreground">原价 <span className="text-foreground">¥{item.originalPrice.toFixed(0)}</span></span>
          <span className="text-muted-foreground">售价 <span className="text-primary font-medium">¥{item.discountPrice.toFixed(0)}</span></span>
          <span className="text-muted-foreground">进价 <span className="text-muted-foreground">¥{item.costPrice.toFixed(0)}</span></span>
        </div>

        <div className="flex items-center gap-4 mt-1.5">
          {/* Stock */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">库存</span>
            <span className={cn("text-sm font-semibold tabular-nums", isLow && "text-red-600")}>{stock}</span>
            <span className="text-[10px] text-muted-foreground">/ {item.safetyStock}</span>
            <div className="flex items-center ml-1">
              <Button variant="outline" size="icon" className="h-5 w-5 rounded-r-none" onClick={() => onAdjust(item.id, -1)}><Minus className="h-2.5 w-2.5" /></Button>
              <Button variant="outline" size="icon" className="h-5 w-5 rounded-l-none border-l-0" onClick={() => onAdjust(item.id, 1)}><Plus className="h-2.5 w-2.5" /></Button>
            </div>
          </div>

          {/* Platform shelves toggles */}
          {connectedPlatforms.length > 0 && (
            <div className="flex items-center gap-1.5">
              {connectedPlatforms.map((p) => {
                const ps = item.platformStatus[p.code];
                const isOn = ps?.shelvesStatus === "on";
                return (
                  <Tooltip key={p.code}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border",
                          isOn ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200",
                          toggling === p.code && "opacity-50"
                        )}
                        disabled={toggling === p.code}
                        onClick={() => handleToggleShelves(p.code, ps?.shelvesStatus || "off")}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isOn ? platformColors[p.code] || "#22c55e" : "#d1d5db" }} />
                        {platformNames[p.code] || p.name}
                        <span className="text-[9px] ml-0.5">{isOn ? "上架" : "下架"}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">
                      {platformNames[p.code]}: {isOn ? "售卖中" : "已下架"}
                      {ps?.status === "failed" && <span className="text-red-500 ml-1">(同步异常)</span>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

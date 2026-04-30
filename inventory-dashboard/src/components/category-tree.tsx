"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";

interface CategoryData {
  categoryL1: string;
  categoryL2: string | null;
}

interface Props {
  data: CategoryData[];
  selectedL1: string | null;
  selectedL2: string | null;
  onSelect: (l1: string | null, l2: string | null) => void;
}

export function CategoryTree({ data, selectedL1, selectedL2, onSelect }: Props) {
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const map = new Map<string, { l2s: Map<string, number>; total: number }>();
    data.forEach((p) => {
      if (!map.has(p.categoryL1)) map.set(p.categoryL1, { l2s: new Map(), total: 0 });
      const e = map.get(p.categoryL1)!;
      e.total++;
      if (p.categoryL2) e.l2s.set(p.categoryL2, (e.l2s.get(p.categoryL2) || 0) + 1);
    });
    return map;
  }, [data]);

  const handleL1Click = (l1: string) => {
    setExpandedL1((prev) => { const n = new Set(prev); n.has(l1) ? n.delete(l1) : n.add(l1); return n; });
    onSelect(l1, null);
  };

  return (
    <aside className="w-[188px] border-r bg-white p-3 flex flex-col shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold">商品分类</h3>
        <button
          className="text-xs text-muted-foreground hover:text-primary"
          onClick={() => onSelect(null, null)}
        >
          全部 ({data.length})
        </button>
      </div>
      <ScrollArea className="flex-1 -mx-1 px-1">
        {Array.from(tree.entries()).map(([l1, d]) => (
          <div key={l1}>
            <button
              onClick={() => handleL1Click(l1)}
              className={cn(
                "flex items-center gap-1 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-muted",
                selectedL1 === l1 && !selectedL2 && "bg-primary/10 text-primary font-medium"
              )}
            >
              {d.l2s.size > 0 ? (
                <ChevronRight className={cn("h-3 w-3 shrink-0 transition", expandedL1.has(l1) && "rotate-90")} />
              ) : (
                <span className="w-3" />
              )}
              {expandedL1.has(l1) ? (
                <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
              ) : (
                <Folder className="h-3 w-3 shrink-0 text-amber-500" />
              )}
              <span className="flex-1 truncate text-left">{l1}</span>
              <span className="text-[10px] text-muted-foreground">{d.total}</span>
            </button>
            {expandedL1.has(l1) &&
              Array.from(d.l2s.entries()).map(([l2, count]) => (
                <button
                  key={l2}
                  onClick={() => onSelect(l1, l2)}
                  className={cn(
                    "block w-full text-left text-[11px] py-0.5 pl-6 rounded hover:bg-muted",
                    selectedL2 === l2 && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {l2} <span className="text-muted-foreground">({count})</span>
                </button>
              ))}
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}

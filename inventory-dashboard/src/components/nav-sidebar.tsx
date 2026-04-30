"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, Truck, RefreshCw, Link2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "库存看板", icon: LayoutDashboard },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/purchase-orders", label: "进货管理", icon: Truck },
  { href: "/platforms", label: "平台授权", icon: Link2 },
  { href: "/sync-tasks", label: "同步任务", icon: RefreshCw },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function NavSidebar() {
  const pathname = usePathname();
  const [syncFails, setSyncFails] = useState(0);

  useEffect(() => {
    const fetchFails = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const res = await fetch("/api/sync-tasks");
        if (!res.ok) return;
        const tasks = await res.json();
        const todayFails = tasks.filter(
          (t: { status: string; createdAt: string }) =>
            (t.status === "failed" || t.status === "partial_fail") && new Date(t.createdAt) >= today
        ).length;
        setSyncFails(todayFails);
      } catch { /* ignore */ }
    };
    fetchFails();
    const interval = setInterval(fetchFails, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[200px] flex-col border-r bg-sidebar">
      <Link href="/" className="flex h-14 items-center gap-2 border-b px-4 hover:bg-sidebar-accent/50">
        <Package className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">库存管理系统</span>
      </Link>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const showBadge = item.href === "/sync-tasks" && syncFails > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">{syncFails}</Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

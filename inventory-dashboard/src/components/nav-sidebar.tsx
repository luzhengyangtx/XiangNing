"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  RefreshCw,
  Link2,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "库存看板", icon: LayoutDashboard },
  { href: "/products", label: "商品管理", icon: Package },
  { href: "/sync-tasks", label: "同步任务", icon: RefreshCw, badge: 2 },
  { href: "/platforms", label: "平台授权", icon: Link2 },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[200px] flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Package className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">库存管理系统</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
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
              {item.badge ? (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          美团闪购 · 已连接
        </div>
      </div>
    </aside>
  );
}

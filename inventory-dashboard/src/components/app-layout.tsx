"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth-context";
import { NavSidebar } from "@/components/nav-sidebar";
import { UserNav } from "@/components/user-nav";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <NavSidebar />
      <div className="ml-[200px] flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b bg-white px-6">
          <UserNav />
        </header>
        <main className="flex-1 bg-zinc-50">{children}</main>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}

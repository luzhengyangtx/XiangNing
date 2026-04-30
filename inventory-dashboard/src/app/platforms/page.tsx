"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchPlatforms, bindPlatform, unbindPlatform } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Link2, Unlink, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  code: string;
  status: string;
  authType: string;
  authData: string | null;
  config: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  connected: { label: "已连接", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
  disconnected: { label: "未连接", color: "bg-gray-100 text-gray-500", icon: <XCircle className="h-5 w-5 text-gray-400" /> },
  expired: { label: "已过期", color: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-5 w-5 text-red-600" /> },
};

export default function PlatformsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadPlatforms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatforms();
      setPlatforms(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadPlatforms();
  }, [authLoading, user, router, loadPlatforms]);

  const handleBind = async (platformId: string) => {
    setActionId(platformId);
    try {
      await bindPlatform(platformId);
      toast.success("授权绑定成功");
      loadPlatforms();
    } catch {
      toast.error("授权失败");
    } finally {
      setActionId(null);
    }
  };

  const handleUnbind = async (platformId: string) => {
    setActionId(platformId);
    try {
      await unbindPlatform(platformId);
      toast.success("已解绑");
      loadPlatforms();
    } catch {
      toast.error("解绑失败");
    } finally {
      setActionId(null);
    }
  };

  if (authLoading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!user) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">平台授权</h1>
        <p className="text-sm text-muted-foreground">管理各即时零售平台的授权绑定</p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((p) => {
            const cfg = statusConfig[p.status] || statusConfig.disconnected;
            const authInfo = p.authData ? JSON.parse(p.authData) : null;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {cfg.icon}
                      <div>
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        <CardDescription>{p.authType === "oauth" ? "OAuth 授权" : "API Key 授权"}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {authInfo && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Token: {authInfo.token?.slice(0, 20)}...</p>
                      <p>过期时间: {authInfo.expiresAt ? new Date(authInfo.expiresAt).toLocaleDateString("zh-CN") : "未知"}</p>
                    </div>
                  )}
                  {p.config && (() => {
                    try {
                      const c = JSON.parse(p.config);
                      return (
                        <div className="mt-2 flex gap-2 text-xs">
                          <Badge variant="outline">价格浮动: {c.priceRatio}x</Badge>
                          <Badge variant="outline">库存比例: {c.stockRatio}x</Badge>
                          <Badge variant="outline">{c.stockMode === "shared" ? "共享库存" : "独占库存"}</Badge>
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </CardContent>
                <CardFooter>
                  {p.status === "connected" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleUnbind(p.id)}
                      disabled={actionId === p.id}
                    >
                      {actionId === p.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-2 h-4 w-4" />
                      )}
                      解除绑定
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleBind(p.id)}
                      disabled={actionId === p.id}
                    >
                      {actionId === p.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      模拟 OAuth 授权
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

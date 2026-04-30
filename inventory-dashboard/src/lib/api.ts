// ── Types ──
export interface PlatformStatusItem {
  status: string;
  errorMessage?: string | null;
}

export interface WarehouseStockItem {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  isUnattendedMode: boolean;
  stock: number;
  unattendedStock: number;
  damagedStock: number;
  shelfId: string | null;
}

export interface InventoryItem {
  id: string;
  title: string;
  sku: string;
  categoryL1: string;
  categoryL2: string | null;
  currentStock: number;
  unattendedStock: number;
  safetyStock: number;
  originalPrice: number;
  discountPrice: number;
  costPrice: number;
  unit: string;
  weight: number | null;
  beijingId: string | null;
  warehouseStocks: WarehouseStockItem[];
  platformStatus: Record<string, PlatformStatusItem>;
}

export interface InventoryResponse {
  items: InventoryItem[];
  totalCount: number;
  lowStockCount: number;
  syncFailures: number;
  categories: string[];
}

// ── Inventory ──
export async function fetchInventory(params?: {
  search?: string; category?: string; warehouseId?: string; sortCol?: string; sortDir?: string;
}): Promise<InventoryResponse> {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.category) sp.set("category", params.category);
  if (params?.warehouseId) sp.set("warehouseId", params.warehouseId);
  if (params?.sortCol) sp.set("sortCol", params.sortCol);
  if (params?.sortDir) sp.set("sortDir", params.sortDir);
  const res = await fetch(`/api/inventory?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

export async function adjustStock(
  productId: string, warehouseId: string, delta: number,
  isUnattended?: boolean, reason?: string,
) {
  const res = await fetch("/api/inventory/adjust", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, warehouseId, delta, isUnattended, reason }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "操作失败"); }
  return res.json();
}

export async function adjustStockBatch(
  items: { productId: string; warehouseId: string; delta: number; isUnattended?: boolean }[],
  reason?: string,
) {
  const res = await fetch("/api/inventory/batch-adjust", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, reason }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "批量操作失败"); }
  return res.json();
}

// ── Products ──
export async function fetchProducts(params?: { search?: string; category?: string }) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.category) sp.set("category", params.category);
  const res = await fetch(`/api/products?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function createProduct(data: Record<string, unknown>) {
  const res = await fetch("/api/products", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "创建失败"); }
  return res.json();
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/products/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "更新失败"); }
  return res.json();
}

export async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "删除失败"); }
  return res.json();
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData(); fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "上传失败"); }
  return (await res.json()).url;
}

// ── Platforms ──
export async function fetchPlatforms() {
  const res = await fetch("/api/platforms");
  if (!res.ok) throw new Error("Failed to fetch platforms");
  return res.json();
}
export async function bindPlatform(platformId: string) {
  const res = await fetch("/api/platforms/bind", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("授权失败");
  return res.json();
}
export async function unbindPlatform(platformId: string) {
  const res = await fetch("/api/platforms/unbind", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("解绑失败");
  return res.json();
}

// ── Sync Tasks ──
export async function fetchSyncTasks() {
  const res = await fetch("/api/sync-tasks");
  if (!res.ok) throw new Error("Failed to fetch sync tasks");
  return res.json();
}
export async function retrySyncTask(taskId: string, itemId?: string) {
  const res = await fetch("/api/sync-tasks/retry", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, itemId }),
  });
  if (!res.ok) throw new Error("重试失败");
  return res.json();
}
export async function triggerSync(platformId: string) {
  const res = await fetch("/api/sync-tasks/trigger", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("触发同步失败");
  return res.json();
}

// ── Logs ──
export async function fetchLogs(params?: { entityType?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.entityType) sp.set("entityType", params.entityType);
  if (params?.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`/api/logs?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

// ── Users ──
export async function fetchUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}
export async function createUser(data: { name: string; email: string; password: string; role: string }) {
  const res = await fetch("/api/users", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "创建失败"); }
  return res.json();
}
export async function deleteUser(id: string) {
  const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "删除失败"); }
  return res.json();
}

// ── Warehouses ──
export async function fetchWarehouses() {
  const res = await fetch("/api/warehouses");
  if (!res.ok) throw new Error("Failed to fetch warehouses");
  return res.json();
}
export async function toggleUnattendedMode(warehouseId: string, enabled: boolean) {
  const res = await fetch(`/api/warehouses/${warehouseId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isUnattendedMode: enabled }),
  });
  if (!res.ok) throw new Error("更新失败");
  return res.json();
}

// ── Purchase Orders ──
export async function fetchPurchaseOrders(params?: { status?: string; warehouseId?: string }) {
  const sp = new URLSearchParams();
  if (params?.status && params.status !== "all") sp.set("status", params.status);
  if (params?.warehouseId) sp.set("warehouseId", params.warehouseId);
  const res = await fetch(`/api/purchase-orders?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}
export async function createPurchaseOrder(data: { warehouseId: string; note?: string; items: { productId: string; quantity: number }[] }) {
  const res = await fetch("/api/purchase-orders", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "创建失败"); }
  return res.json();
}
export async function updatePurchaseOrder(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/purchase-orders/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "更新失败"); }
  return res.json();
}
export async function deletePurchaseOrder(id: string) {
  const res = await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "删除失败"); }
  return res.json();
}

// ── Auth ──
export async function login(email: string, password: string) {
  const res = await fetch("/api/auth", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || "登录失败"); }
  return res.json();
}
export async function logout() { await fetch("/api/auth", { method: "DELETE" }); }
export async function getCurrentUser() {
  const res = await fetch("/api/auth");
  if (!res.ok) return null;
  return (await res.json()).user;
}

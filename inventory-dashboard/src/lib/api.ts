export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  safetyStock: number;
  price: number;
  unit: string;
  platformStatus: Record<string, string>;
}

export interface InventoryResponse {
  items: InventoryItem[];
  totalCount: number;
  lowStockCount: number;
  syncFailures: number;
  categories: string[];
}

export async function fetchInventory(params?: {
  search?: string;
  category?: string;
  sortCol?: string;
  sortDir?: string;
}): Promise<InventoryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.sortCol) searchParams.set("sortCol", params.sortCol);
  if (params?.sortDir) searchParams.set("sortDir", params.sortDir);

  const res = await fetch(`/api/inventory?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

export async function adjustStock(
  productId: string,
  delta: number,
  reason?: string
): Promise<{ productId: string; currentStock: number }> {
  const res = await fetch("/api/inventory/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, delta, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "操作失败");
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "登录失败");
  }
  return res.json();
}

export async function logout() {
  await fetch("/api/auth", { method: "DELETE" });
}

export async function adjustStockBatch(
  items: { productId: string; delta: number }[],
  reason?: string
): Promise<{ results: { productId: string; currentStock: number; error?: string }[] }> {
  const res = await fetch("/api/inventory/batch-adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "批量操作失败");
  }
  return res.json();
}

export async function fetchProducts(params?: { search?: string; category?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.category) searchParams.set("category", params.category);
  const res = await fetch(`/api/products?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function createProduct(data: {
  name: string; sku: string; category: string; price: number;
  unit?: string; barcode?: string; description?: string;
  safetyStock?: number; currentStock?: number; mainImage?: string;
}) {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "创建失败");
  }
  return res.json();
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新失败");
  return res.json();
}

export async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除失败");
  return res.json();
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "上传失败");
  }
  const data = await res.json();
  return data.url;
}

export async function fetchPlatforms() {
  const res = await fetch("/api/platforms");
  if (!res.ok) throw new Error("Failed to fetch platforms");
  return res.json();
}

export async function bindPlatform(platformId: string) {
  const res = await fetch(`/api/platforms/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("授权失败");
  return res.json();
}

export async function unbindPlatform(platformId: string) {
  const res = await fetch(`/api/platforms/unbind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("解绑失败");
  return res.json();
}

export async function fetchSyncTasks() {
  const res = await fetch("/api/sync-tasks");
  if (!res.ok) throw new Error("Failed to fetch sync tasks");
  return res.json();
}

export async function retrySyncTask(taskId: string, itemId?: string) {
  const res = await fetch("/api/sync-tasks/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, itemId }),
  });
  if (!res.ok) throw new Error("重试失败");
  return res.json();
}

export async function triggerSync(platformId: string) {
  const res = await fetch("/api/sync-tasks/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformId }),
  });
  if (!res.ok) throw new Error("触发同步失败");
  return res.json();
}

export async function fetchLogs(params?: { entityType?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const res = await fetch(`/api/logs?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function getCurrentUser() {
  const res = await fetch("/api/auth");
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

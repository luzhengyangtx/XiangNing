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

export async function getCurrentUser() {
  const res = await fetch("/api/auth");
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

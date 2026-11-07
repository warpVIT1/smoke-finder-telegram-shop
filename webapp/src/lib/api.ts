import { getInitData } from "./telegram";

// Same-origin by default — the bot server now serves this webapp itself, so
// relative paths just work in both production and local dev (via the Vite
// proxy in vite.config.ts). Only set VITE_API_URL to override that.
export const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface ApiProduct {
  id: string;
  category: string;
  name: string;
  flavour: string | null;
  priceCents: number;
  oldPriceCents: number | null;
  badge: string | null;
  badgeBg: string | null;
  stockState: "in_stock" | "low" | "preorder";
  stockCount: number | null;
  puffs: number | null;
  nicotineMg: number;
  charging: string | null;
  volumeMl: number | null;
  bestSeller: boolean;
  isNew: boolean;
  imageUrl: string | null;
  variantLabel: "flavour" | "colour" | "ohm";
  pointsPrice: number | null;
}

export interface ApiFlavour {
  name: string;
  soldOut: boolean;
  descriptionEn: string | null;
  descriptionUk: string | null;
  descriptionRu: string | null;
}

export interface ApiProductDetail extends ApiProduct {
  flavours: ApiFlavour[];
}

/** Product photos are uploaded via the local admin tool but served by this same API. */
export function imageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_URL}${imageUrl}` : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function fetchProducts(params?: { category?: string; q?: string }): Promise<ApiProduct[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return request(`/api/products${qs ? `?${qs}` : ""}`);
}

export function fetchProduct(id: string): Promise<ApiProductDetail> {
  return request(`/api/products/${id}`);
}

export interface CreateOrderInput {
  items: { productId: string; flavour?: string; qty: number }[];
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "e_transfer" | "cash" | "wallet_pay" | "points";
  contactName?: string;
  contactPhone?: string;
  address?: string;
  promoCode?: string;
}

export interface CreateOrderResult {
  orderId: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  walletPayLink?: string;
}

export function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return request("/api/orders", { method: "POST", body: JSON.stringify(input) });
}

export interface ApiOrder {
  id: number;
  status: string;
  deliveryMethod: string;
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
  items: { productId: string; flavour: string | null; qty: number; unitPriceCents: number }[];
}

export function fetchOrders(): Promise<ApiOrder[]> {
  return request("/api/orders");
}

export interface ApiMe {
  telegramId: number;
  firstName: string | null;
  username: string | null;
  points: number;
  memberSince: string;
  phone: string | null;
  discountPercent: number;
}

export function fetchMe(): Promise<ApiMe> {
  return request("/api/me");
}

export function setMyLanguage(language: "en" | "uk" | "ru"): Promise<void> {
  return request("/api/me", { method: "PATCH", body: JSON.stringify({ language }) });
}

/** For building the t.me/<username>?start=<telegramId> referral link. */
export function fetchBotInfo(): Promise<{ username: string }> {
  return request("/api/bot-info");
}

export interface ApiAddress {
  id: number;
  address: string;
  createdAt: string;
}

export function fetchAddresses(): Promise<ApiAddress[]> {
  return request("/api/addresses");
}

export function createAddress(address: string): Promise<ApiAddress> {
  return request("/api/addresses", { method: "POST", body: JSON.stringify({ address }) });
}

/** Asks the bot to drop the "write your question" hint into the customer's
 * own chat with it (as a real Telegram message, primed for a reply) — their
 * next message gets relayed to the manager along with this context (an
 * order, a wishlist prepayment request, or neither), if given. */
export function sendContactHint(context?: { orderId?: number; prepay?: { productId: string; flavour?: string } }): Promise<void> {
  return request("/api/contact-hint", { method: "POST", body: JSON.stringify(context ?? {}) });
}

export function addToWishlist(productId: string, flavour?: string): Promise<void> {
  return request("/api/wishlist", { method: "POST", body: JSON.stringify({ productId, flavour }) });
}

export interface ApiMyWishlistEntry {
  id: number;
  productId: string;
  flavour: string | null;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  createdAt: string;
}

export function fetchMyWishlist(): Promise<ApiMyWishlistEntry[]> {
  return request("/api/wishlist/mine");
}

export function removeFromWishlist(id: number): Promise<void> {
  return request(`/api/wishlist/${id}`, { method: "DELETE" });
}

export interface ApiWishlistEntry {
  productId: string;
  name: string;
  brand: string | null;
  flavour: string | null;
  count: number;
  wishers: { telegramId: number; label: string }[];
}

export interface ApiWishlistUser {
  telegramId: number;
  label: string;
  items: { id: number; productId: string; name: string; flavour: string | null; priceCents: number; imageUrl: string | null; createdAt: string; paid: boolean }[];
}

export interface ApiAdminWishlistView {
  byProduct: ApiWishlistEntry[];
  users: ApiWishlistUser[];
}

export function fetchAdminWishlist(): Promise<ApiAdminWishlistView> {
  return request("/api/admin/wishlist");
}

export function setAdminWishlistPaid(id: number, paid: boolean): Promise<void> {
  return request(`/api/admin/wishlist/${id}`, { method: "PATCH", body: JSON.stringify({ paid }) });
}

export interface ApiAdminOrder {
  id: number;
  telegramId: number;
  customerName: string | null;
  customerUsername: string | null;
  status: string;
  deliveryMethod: string;
  paymentMethod: string;
  contactPhone: string | null;
  address: string | null;
  totalCents: number;
  createdAt: string;
  paymentConfirmed: boolean;
  hasPaymentProof: boolean;
  items: { name: string; flavour: string | null; qty: number; unitPriceCents: number }[];
}

export function fetchAdminOrders(): Promise<ApiAdminOrder[]> {
  return request("/api/admin/orders");
}

export function setAdminOrderStatus(id: number, status: string): Promise<void> {
  return request(`/api/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function deleteAddress(id: number): Promise<void> {
  return request(`/api/addresses/${id}`, { method: "DELETE" });
}

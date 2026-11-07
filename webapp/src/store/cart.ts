import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  name: string;
  flavour?: string;
  unitPriceCents: number;
  pointsPrice?: number | null;
  qty: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty: number) => void;
  setQty: (productId: string, flavour: string | undefined, qty: number) => void;
  removeItem: (productId: string, flavour?: string) => void;
  clear: () => void;
}

function sameLine(a: CartItem, productId: string, flavour?: string) {
  return a.productId === productId && (a.flavour ?? "") === (flavour ?? "");
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, qty) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item.productId, item.flavour));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, item.productId, item.flavour) ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),
      setQty: (productId, flavour, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => !sameLine(i, productId, flavour))
              : state.items.map((i) => (sameLine(i, productId, flavour) ? { ...i, qty } : i)),
        })),
      removeItem: (productId, flavour) =>
        set((state) => ({ items: state.items.filter((i) => !sameLine(i, productId, flavour)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "sf-cart" }
  )
);

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function cartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
}

/** Only meaningful when every line has a points price — callers check
 * `cartAllPointsPriced` first before offering to pay with points. */
export function cartPointsCost(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.pointsPrice ?? 0) * i.qty, 0);
}

export function cartAllPointsPriced(items: CartItem[]): boolean {
  return items.length > 0 && items.every((i) => i.pointsPrice != null);
}

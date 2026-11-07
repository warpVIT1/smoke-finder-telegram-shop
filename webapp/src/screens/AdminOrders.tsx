import { useEffect, useState } from "react";
import {
  fetchAdminOrders,
  setAdminOrderStatus,
  fetchAdminWishlist,
  setAdminWishlistPaid,
  type ApiAdminOrder,
  type ApiAdminWishlistView,
} from "../lib/api";
import { formatCents } from "../lib/format";

const STATUSES = ["placed", "accepted", "packed", "ready_pickup", "delivered", "cancelled"] as const;

export function AdminOrders() {
  const [orders, setOrders] = useState<ApiAdminOrder[] | null>(null);
  const [wishlist, setWishlist] = useState<ApiAdminWishlistView | null>(null);
  const [tab, setTab] = useState<"orders" | "wishlist">("orders");
  const [openUser, setOpenUser] = useState<number | null>(null);

  const load = () => fetchAdminOrders().then(setOrders).catch(() => setOrders([]));
  const loadWishlist = () => fetchAdminWishlist().then(setWishlist).catch(() => setWishlist({ byProduct: [], users: [] }));
  useEffect(() => {
    load();
    loadWishlist();
  }, []);

  const handleTogglePaid = async (telegramId: number, itemId: number, nextPaid: boolean) => {
    setWishlist((prev) =>
      prev
        ? {
            ...prev,
            users: prev.users.map((u) =>
              u.telegramId !== telegramId ? u : { ...u, items: u.items.map((it) => (it.id !== itemId ? it : { ...it, paid: nextPaid })) }
            ),
          }
        : prev
    );
    try {
      await setAdminWishlistPaid(itemId, nextPaid);
    } catch (err) {
      console.error("Failed to toggle wishlist item paid:", err);
      loadWishlist();
    }
  };

  return (
    <div className="sf-screen" style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setTab("orders")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: "var(--radius-sm)",
            border: "none",
            font: "700 13px var(--font-heading)",
            background: tab === "orders" ? "var(--sf-accent)" : "var(--color-neutral-900)",
            color: tab === "orders" ? "#1B0703" : "var(--color-text)",
          }}
        >
          Orders
        </button>
        <button
          onClick={() => setTab("wishlist")}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: "var(--radius-sm)",
            border: "none",
            font: "700 13px var(--font-heading)",
            background: tab === "wishlist" ? "var(--sf-accent)" : "var(--color-neutral-900)",
            color: tab === "wishlist" ? "#1B0703" : "var(--color-text)",
          }}
        >
          Wishlist{wishlist ? ` (${wishlist.byProduct.length})` : ""}
        </button>
      </div>

      {tab === "wishlist" ? (
        <>
          {wishlist === null && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>Loading…</div>}
          {wishlist?.byProduct.length === 0 && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>Nobody's wishlisted anything yet</div>}
          {wishlist?.byProduct.map((w) => (
            <div key={`${w.productId}::${w.flavour ?? ""}`} className="sf-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ font: "600 13px var(--font-body)" }}>
                    {w.name}
                    {w.flavour && <span style={{ color: "var(--sf-accent)" }}> · {w.flavour}</span>}
                  </div>
                  {w.brand && <div style={{ font: "400 11px var(--font-body)", color: "var(--color-neutral-500)" }}>{w.brand}</div>}
                </div>
                <span style={{ font: "700 15px var(--font-heading)", color: "var(--sf-accent)" }}>{w.count}</span>
              </div>
              <div style={{ font: "400 11px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {w.wishers.map((p) => (
                  <span
                    key={p.telegramId}
                    onClick={() => setOpenUser((cur) => (cur === p.telegramId ? null : p.telegramId))}
                    style={{ textDecoration: "underline", color: "var(--sf-accent)", cursor: "pointer" }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
              {openUser != null &&
                w.wishers.some((p) => p.telegramId === openUser) &&
                (() => {
                  const user = wishlist.users.find((u) => u.telegramId === openUser);
                  if (!user) return null;
                  return (
                    <div style={{ marginTop: 8, background: "var(--color-neutral-900)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                      {user.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                          <span style={{ font: "400 11.5px var(--font-body)" }}>
                            {it.name}
                            {it.flavour && <span style={{ color: "var(--sf-accent)" }}> · {it.flavour}</span>}
                          </span>
                          <span
                            onClick={() => handleTogglePaid(user.telegramId, it.id, !it.paid)}
                            style={{ font: "600 10.5px var(--font-body)", color: it.paid ? "var(--color-ok)" : "var(--color-neutral-500)", cursor: "pointer" }}
                          >
                            {it.paid ? "✅ Оплачено" : "Отметить оплаченным"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
            </div>
          ))}
        </>
      ) : (
        <OrdersTab orders={orders} setOrders={setOrders} load={load} />
      )}
    </div>
  );
}

function OrdersTab({
  orders,
  setOrders,
  load,
}: {
  orders: ApiAdminOrder[] | null;
  setOrders: React.Dispatch<React.SetStateAction<ApiAdminOrder[] | null>>;
  load: () => void;
}) {
  return (
    <>
      <div style={{ font: "700 18px var(--font-heading)" }}>Admin · Orders</div>
      {orders === null && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>Loading…</div>}
      {orders?.length === 0 && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>No orders yet</div>}
      {orders?.map((o) => (
        <div key={o.id} className="sf-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ font: "600 13px var(--font-body)" }}>
              #{o.id} · {o.customerUsername ? `@${o.customerUsername}` : o.customerName ?? o.telegramId} · {formatCents(o.totalCents)}
            </span>
            <select
              value={o.status}
              onChange={async (e) => {
                const status = e.target.value;
                setOrders((prev) => prev?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? null);
                try {
                  await setAdminOrderStatus(o.id, status);
                } catch {
                  load();
                }
              }}
              style={{
                background: "var(--color-neutral-900)",
                color: "var(--color-text)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px",
                font: "600 11px var(--font-body)",
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ font: "400 11px var(--font-body)", color: "var(--color-neutral-500)" }}>
            {o.items.map((i) => `${i.name}${i.flavour ? ` (${i.flavour})` : ""} ×${i.qty}`).join(", ")}
          </div>
          <div style={{ font: "400 11px var(--font-body)", color: "var(--color-neutral-500)" }}>
            {o.deliveryMethod === "courier" ? `Courier → ${o.address ?? "-"}` : "Pickup"} · {o.paymentMethod} · {o.contactPhone ?? "-"} ·{" "}
            {new Date(o.createdAt).toLocaleString()}
          </div>
          {o.paymentMethod === "e_transfer" && (
            <div
              style={{
                font: "600 10px var(--font-body)",
                color: o.paymentConfirmed ? "var(--color-ok)" : o.hasPaymentProof ? "var(--sf-accent)" : "var(--color-error)",
              }}
            >
              {o.paymentConfirmed ? "Payment confirmed" : o.hasPaymentProof ? "Screenshot received — awaiting confirmation" : "No screenshot yet"}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

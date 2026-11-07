import { useEffect, useState, type CSSProperties } from "react";
import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { QtyStepper } from "../components/QtyStepper";
import { ActionButton } from "../components/ActionButton";
import { formatCents } from "../lib/format";
import { calcTotals } from "../lib/pricing";
import { useBackButton, getTelegramUser, getWebApp, openTelegramLink } from "../lib/telegram";
import { useCartStore, cartSubtotalCents, cartPointsCost, cartAllPointsPriced } from "../store/cart";
import { createOrder, fetchMe } from "../lib/api";

interface CartProps {
  onBack: () => void;
  onOrderPlaced: () => void;
}

export function Cart({ onBack, onOrderPlaced }: CartProps) {
  const { t } = useLang();
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const clear = useCartStore((s) => s.clear);

  const tgUser = getTelegramUser();
  const [delivery, setDelivery] = useState<"courier" | "pickup">("courier");
  const [payment, setPayment] = useState<"e_transfer" | "cash" | "wallet_pay" | "points">("cash");
  const [promo, setPromo] = useState("");
  const [name, setName] = useState(tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") : "");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  useBackButton(onBack);

  // Canada-only for now: fixed +1 prefix, exactly 10 digits after it.
  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (me.phone?.startsWith("+1")) setPhoneDigits(me.phone.slice(2));
        setPointsBalance(me.points ?? 0);
        setDiscountPercent(me.discountPercent ?? 0);
      })
      .catch(() => {});
  }, []);

  const subtotal = cartSubtotalCents(items);
  const { discountCents, shippingCents, taxCents, totalCents } = calcTotals(subtotal, delivery, discountPercent);
  const pointsCost = cartPointsCost(items);
  const canPayWithPoints = cartAllPointsPriced(items) && pointsBalance >= pointsCost && pointsCost > 0;
  const payingWithPoints = payment === "points";
  const displayTotalCents = payingWithPoints ? 0 : totalCents;
  const addressNeeded = delivery === "courier";
  const phoneValid = phoneDigits.length === 10;
  const canSubmit = items.length > 0 && phoneValid && (!addressNeeded || address.trim().length > 0) && !submitting;

  const handlePlaceOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createOrder({
        items: items.map((i) => ({ productId: i.productId, flavour: i.flavour, qty: i.qty })),
        deliveryMethod: delivery,
        paymentMethod: payment,
        contactName: name || undefined,
        contactPhone: `+1${phoneDigits}`,
        address: addressNeeded ? address : undefined,
        promoCode: promo || undefined,
      });
      clear();
      getWebApp()?.HapticFeedback.notificationOccurred("success");
      // Wallet Pay per docs.wallet.tg/pay: open the pay link with
      // openTelegramLink, not a plain browser navigation.
      if (result.walletPayLink) openTelegramLink(result.walletPayLink);
      onOrderPlaced();
    } catch (err) {
      getWebApp()?.HapticFeedback.notificationOccurred("error");
      alert(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header title={t.cartTitle} onBack={onBack} />
      <div className="sf-screen">
        {items.length === 0 && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.emptyCart}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div key={`${item.productId}-${item.flavour ?? ""}`} style={{ display: "flex", gap: 10, background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: 10 }}>
              <div style={{ width: 50, height: 50, borderRadius: "var(--radius-sm)", background: "linear-gradient(145deg,#2b2d3c,#1d1f2c)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 12.5px var(--font-body)" }}>{item.name}</div>
                {item.flavour && <div style={{ font: "400 10.5px var(--font-body)", color: "var(--color-neutral-500)", marginTop: 2 }}>{item.flavour}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between" }}>
                <span style={{ font: "600 13px var(--font-body)" }}>{formatCents(item.unitPriceCents * item.qty)}</span>
                <QtyStepper qty={item.qty} onChange={(q) => setQty(item.productId, item.flavour, q)} min={0} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder={t.promoPh}
            style={{ flex: 1, background: "var(--color-neutral-900)", borderRadius: "var(--radius-md)", padding: "11px 13px", border: "none", color: "var(--color-text)", font: "400 12px var(--font-body)" }}
          />
        </div>

        <div>
          <div className="sf-section-label">{t.deliveryLbl}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <DeliveryOption
              selected={delivery === "courier"}
              onSelect={() => setDelivery("courier")}
              title={t.courierT}
              subtitle={t.courierS}
              trailing={formatCents(1200)}
            />
            <DeliveryOption
              selected={delivery === "pickup"}
              onSelect={() => setDelivery("pickup")}
              title={t.pickupT}
              subtitle={t.pickupS}
              trailing={t.free}
              trailingColor="var(--color-ok)"
            />
          </div>
        </div>

        <div>
          <div className="sf-section-label">{t.paymentLbl}</div>
          <div style={{ display: "flex", gap: 7 }}>
            {/* Hidden for now per request — only cash is offered while
                e-Transfer is paused. Backend flow (screenshot proof, group
                review) stays intact; uncomment to bring it back. */}
            {/* <PaymentOption selected={payment === "e_transfer"} onSelect={() => setPayment("e_transfer")} title={t.etT} subtitle={t.etS} /> */}
            <PaymentOption selected={payment === "cash"} onSelect={() => setPayment("cash")} title={t.cashT} subtitle={t.cashS} />
            {/* Wallet Pay is built and wired end-to-end (see routes/orders.ts,
                lib/walletPay.ts, routes/walletPayWebhook.ts) but hidden here —
                Wallet Pay paused new merchant applications, so there's no API
                key yet. Just uncomment once WALLET_PAY_API_KEY is set. */}
            {/* <PaymentOption selected={payment === "wallet_pay"} onSelect={() => setPayment("wallet_pay")} title={t.wpT} subtitle={t.wpS} /> */}
            {canPayWithPoints && (
              <PaymentOption
                selected={payment === "points"}
                onSelect={() => setPayment("points")}
                title={t.pointsT}
                subtitle={t.pointsS(pointsCost)}
              />
            )}
          </div>
          {payment === "e_transfer" && (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                font: "400 11.5px/1.4 var(--font-body)",
                color: "var(--color-neutral-400)",
              }}
            >
              {t.etProofNote}
            </div>
          )}
        </div>

        <div>
          <div className="sf-section-label">{t.contactsLbl}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.nameLbl} style={fieldStyle} />
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span
                style={{
                  padding: "11px 13px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-neutral-900)",
                  color: "var(--color-neutral-400)",
                  font: "600 12.5px var(--font-body)",
                }}
              >
                +1
              </span>
              <input
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder={`${t.phoneLbl} * (403 555 0100)`}
                inputMode="numeric"
                style={fieldStyle}
              />
            </div>
            {addressNeeded && (
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.addressPh} style={fieldStyle} />
            )}
            {items.length > 0 && !phoneValid && (
              <div style={{ font: "400 11px var(--font-body)", color: "var(--color-error)" }}>{t.phoneRequiredHint}</div>
            )}
            {items.length > 0 && phoneValid && addressNeeded && address.trim().length === 0 && (
              <div style={{ font: "400 11px var(--font-body)", color: "var(--color-error)" }}>{t.addressRequiredHint}</div>
            )}
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7, font: "400 12px var(--font-body)" }}>
          <Row label={t.subtotal} value={formatCents(subtotal)} />
          {discountCents > 0 && <Row label={t.discountLbl} value={`-${formatCents(discountCents)}`} />}
          <Row label={t.shipping} value={formatCents(shippingCents)} />
          <Row label={t.tax} value={formatCents(taxCents)} />
          <div style={{ display: "flex", justifyContent: "space-between", font: "600 14px var(--font-body)", borderTop: "1px solid var(--color-divider)", paddingTop: 8 }}>
            <span>{t.total}</span>
            <span>{payingWithPoints ? t.pointsS(pointsCost) : formatCents(displayTotalCents)}</span>
          </div>
        </div>
      </div>
      <ActionButton
        text={submitting ? t.loading : t.placeOrderLabel(payingWithPoints ? t.pointsS(pointsCost) : formatCents(displayTotalCents))}
        onClick={handlePlaceOrder}
        active={canSubmit}
        loading={submitting}
      />
    </>
  );
}

const fieldStyle: CSSProperties = {
  flex: 1,
  background: "var(--color-neutral-900)",
  borderRadius: "var(--radius-md)",
  padding: "11px 13px",
  border: "none",
  color: "var(--color-text)",
  font: "600 12.5px var(--font-body)",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-neutral-500)" }}>
      <span>{label}</span>
      <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function DeliveryOption({
  selected,
  onSelect,
  title,
  subtitle,
  trailing,
  trailingColor,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  trailing: string;
  trailingColor?: string;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--color-surface)",
        border: selected ? "1px solid var(--sf-accent)" : "1px solid transparent",
        borderRadius: "var(--radius-md)",
        padding: "11px 12px",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: "50%",
          border: selected ? "4.5px solid var(--sf-accent)" : "1.5px solid var(--color-neutral-600)",
          boxSizing: "border-box",
          flex: "none",
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 12.5px var(--font-body)" }}>{title}</div>
        <div style={{ font: "400 10.5px var(--font-body)", color: "var(--color-neutral-500)" }}>{subtitle}</div>
      </div>
      <span style={{ font: "600 12.5px var(--font-body)", color: trailingColor }}>{trailing}</span>
    </div>
  );
}

function PaymentOption({ selected, onSelect, title, subtitle }: { selected: boolean; onSelect: () => void; title: string; subtitle: string }) {
  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1,
        background: "var(--color-surface)",
        border: selected ? "1px solid var(--sf-accent)" : "1px solid transparent",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      <div style={{ font: "600 12px var(--font-body)", color: selected ? "var(--color-text)" : "var(--color-neutral-300)" }}>{title}</div>
      <div style={{ font: "400 9.5px var(--font-body)", color: selected ? "var(--sf-accent)" : "var(--color-neutral-600)", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

export const ALBERTA_GST_RATE = 0.05;
export const COURIER_SHIPPING_CENTS = 1200;
export const PICKUP_SHIPPING_CENTS = 0;

export function calcTotals(subtotalCents: number, deliveryMethod: "courier" | "pickup", discountPercent = 0) {
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const shippingCents = deliveryMethod === "courier" ? COURIER_SHIPPING_CENTS : PICKUP_SHIPPING_CENTS;
  const taxCents = Math.round((subtotalCents - discountCents + shippingCents) * ALBERTA_GST_RATE);
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
  return { discountCents, shippingCents, taxCents, totalCents };
}

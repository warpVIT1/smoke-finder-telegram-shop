export const ALBERTA_GST_RATE = 0.05;
export const COURIER_SHIPPING_CENTS = 1200;
export const PICKUP_SHIPPING_CENTS = 0;

export interface CartLine {
  unitPriceCents: number;
  qty: number;
}

export function calcSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
}

export function calcShippingCents(deliveryMethod: "courier" | "pickup"): number {
  return deliveryMethod === "courier" ? COURIER_SHIPPING_CENTS : PICKUP_SHIPPING_CENTS;
}

export function calcTaxCents(subtotalCents: number, shippingCents: number): number {
  return Math.round((subtotalCents + shippingCents) * ALBERTA_GST_RATE);
}

export function calcTotals(lines: CartLine[], deliveryMethod: "courier" | "pickup", discountPercent = 0) {
  const subtotalCents = calcSubtotalCents(lines);
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const shippingCents = calcShippingCents(deliveryMethod);
  const taxCents = calcTaxCents(subtotalCents - discountCents, shippingCents);
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
  return { subtotalCents, discountCents, shippingCents, taxCents, totalCents };
}

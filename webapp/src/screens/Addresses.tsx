import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { Header } from "../components/Header";
import { useBackButton } from "../lib/telegram";
import { fetchAddresses, createAddress, deleteAddress, type ApiAddress } from "../lib/api";

interface AddressesProps {
  onBack: () => void;
}

export function Addresses({ onBack }: AddressesProps) {
  const { t } = useLang();
  const [addresses, setAddresses] = useState<ApiAddress[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useBackButton(onBack);

  useEffect(() => {
    fetchAddresses()
      .then(setAddresses)
      .catch(() => setAddresses([]));
  }, []);

  const handleAdd = async () => {
    const address = draft.trim();
    if (!address || saving) return;
    setSaving(true);
    try {
      const created = await createAddress(address);
      setAddresses((prev) => [created, ...(prev ?? [])]);
      setDraft("");
    } catch {
      // leave the draft in place so the user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setAddresses((prev) => prev?.filter((a) => a.id !== id) ?? null);
    try {
      await deleteAddress(id);
    } catch {
      fetchAddresses().then(setAddresses).catch(() => {});
    }
  };

  return (
    <>
      <Header title={t.addresses} onBack={onBack} />
      <div className="sf-screen">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.addressPh}
            style={{
              flex: 1,
              background: "var(--color-neutral-900)",
              borderRadius: "var(--radius-md)",
              padding: "11px 13px",
              border: "none",
              color: "var(--color-text)",
              font: "400 13px var(--font-body)",
            }}
          />
          <span
            onClick={handleAdd}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "11px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--sf-accent)",
              color: "var(--sf-accent)",
              font: "600 12px var(--font-body)",
              cursor: "pointer",
              opacity: draft.trim() && !saving ? 1 : 0.5,
            }}
          >
            {t.addAddressBtn}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {addresses === null && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.loading}</div>}
          {addresses?.length === 0 && <div style={{ color: "var(--color-neutral-500)", textAlign: "center", padding: 24 }}>{t.noAddresses}</div>}
          {addresses?.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
              }}
            >
              <span style={{ flex: 1, font: "500 13px/1.4 var(--font-body)" }}>{a.address}</span>
              <span
                onClick={() => handleDelete(a.id)}
                style={{ font: "600 11px var(--font-body)", color: "var(--color-error)", cursor: "pointer" }}
              >
                {t.deleteBtn}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

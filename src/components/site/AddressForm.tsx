import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Address, AddressPayload } from "@/hooks/useAddresses";
import { addressSchema } from "@/lib/api/validation";

const EMPTY: AddressPayload = {
  label: "Home",
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  phone: "",
  isDefault: false,
};

export function AddressForm({
  address,
  submitting,
  onSubmit,
  onCancel,
}: {
  address?: Address | undefined;
  submitting: boolean;
  onSubmit: (values: AddressPayload) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<AddressPayload>(
    address
      ? {
          label: address.label,
          recipientName: address.recipientName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
          isDefault: address.isDefault,
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof AddressPayload>(key: K, value: AddressPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Mirrors the server-side schema; the server validates again regardless.
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});
    onSubmit(form);
  }

  const field = (
    key: keyof AddressPayload,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`addr-${key}`}>{label}</Label>
      <Input
        id={`addr-${key}`}
        value={(form[key] as string) ?? ""}
        onChange={(event) => set(key, event.target.value as AddressPayload[typeof key])}
        aria-invalid={Boolean(errors[key])}
        {...props}
      />
      {errors[key] ? <p className="text-xs text-destructive">{errors[key][0]}</p> : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("label", "Label")}
        {field("recipientName", "Recipient name")}
      </div>
      {field("line1", "Address line 1")}
      {field("line2", "Address line 2 (optional)")}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("city", "City")}
        {field("state", "State / region")}
        {field("postalCode", "Postal code")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("country", "Country code", { maxLength: 2, placeholder: "US" })}
        {field("phone", "Phone (optional)")}
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id="addr-default"
          checked={form.isDefault}
          onCheckedChange={(checked) => set("isDefault", checked === true)}
        />
        <Label htmlFor="addr-default" className="text-sm font-normal">
          Use as my default delivery address
        </Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save address"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

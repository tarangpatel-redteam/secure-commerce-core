import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RequireSession } from "@/components/site/RequireSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABEL, useAccount } from "@/hooks/useAccount";
import { useCart } from "@/hooks/useCart";
import { ApiError, apiFetch } from "@/lib/api-client";
import { profileUpdateSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — ACME Commerce" },
      { name: "description", content: "Manage your ACME Commerce profile and contact details." },
      { property: "og:title", content: "Your account — ACME Commerce" },
      { property: "og:description", content: "Manage your ACME Commerce profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <RequireSession
      title="Sign in to your account"
      description="Manage your profile, contact details and preferences."
    >
      <AccountDetails />
    </RequireSession>
  );
}

const ROLE_CAPABILITIES: Record<string, string> = {
  customer: "Browse the catalogue and manage your own bag and profile.",
  employee: "Customer-facing support access, including the customer directory.",
  manager: "Employee access plus catalogue management across the store.",
  administrator: "Full access, including role assignment across all accounts.",
};

function AccountDetails() {
  const { data: account, isLoading } = useAccount(true);
  const { data: cart } = useCart(true);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ fullName: "", phone: "", marketingOptIn: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setForm({
        fullName: account.fullName,
        phone: account.phone,
        marketingOptIn: account.marketingOptIn,
      });
    }
  }, [account]);

  if (isLoading || !account) {
    return (
      <div className="container-page py-16">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = profileUpdateSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await apiFetch("/me", { method: "PATCH", body: parsed.data });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to save your changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-page py-12">
      <p className="eyebrow">Account</p>
      <h1 className="mt-2 text-4xl">{account.fullName || "Your account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{account.email}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-7 shadow-card"
          noValidate
        >
          <h2 className="text-lg">Profile details</h2>
          <Separator className="my-5" />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
                aria-invalid={Boolean(errors["fullName"])}
              />
              {errors["fullName"] ? (
                <p className="text-xs text-destructive">{errors["fullName"][0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
                aria-invalid={Boolean(errors["phone"])}
              />
              {errors["phone"] ? (
                <p className="text-xs text-destructive">{errors["phone"][0]}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3">
            <Checkbox
              id="marketing"
              checked={form.marketingOptIn}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, marketingOptIn: checked === true }))
              }
            />
            <Label htmlFor="marketing" className="text-sm font-normal leading-relaxed">
              Email me occasional product news. No more than once a month.
            </Label>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" value={account.email} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Your sign-in address cannot be changed in this release.
            </p>
          </div>

          <Button type="submit" className="mt-7" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg">Access level</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {account.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {ROLE_LABEL[role]}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {ROLE_CAPABILITIES[account.primaryRole]}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Roles are stored server-side and verified on every request.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg">At a glance</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items in bag</dt>
                <dd>{cart?.itemCount ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Member since</dt>
                <dd>
                  {account.memberSince
                    ? new Date(account.memberSince).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

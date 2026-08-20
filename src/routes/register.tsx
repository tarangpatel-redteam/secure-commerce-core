import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { registerSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create an account — ACME Commerce" },
      {
        name: "description",
        content:
          "Create an ACME Commerce account to save your bag, track your profile and check out faster.",
      },
      { property: "og:title", content: "Create an account — ACME Commerce" },
      { property: "og:description", content: "Join ACME Commerce in under a minute." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/account", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created");
    void navigate({ to: "/account", replace: true });
  }

  return (
    <div className="container-page flex justify-center py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-3xl">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It takes under a minute and keeps your bag in sync.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              value={form.fullName}
              onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
              aria-invalid={Boolean(errors["fullName"])}
            />
            {errors["fullName"] ? (
              <p className="text-xs text-destructive">{errors["fullName"][0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              aria-invalid={Boolean(errors["email"])}
            />
            {errors["email"] ? (
              <p className="text-xs text-destructive">{errors["email"][0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
              aria-invalid={Boolean(errors["password"])}
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters with upper case, lower case and a number.
            </p>
            {errors["password"] ? (
              <p className="text-xs text-destructive">{errors["password"][0]}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema } from "@/lib/api/validation";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ACME Commerce" },
      {
        name: "description",
        content: "Sign in to your ACME Commerce account to view your bag, orders and profile.",
      },
      { property: "og:title", content: "Sign in — ACME Commerce" },
      { property: "og:description", content: "Access your ACME Commerce account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/account", replace: true });
  }, [loading, session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);

    if (error) {
      // Deliberately generic: never reveal whether the address exists.
      toast.error("Those sign-in details didn't work. Please try again.");
      return;
    }
    toast.success("Welcome back");
    void navigate({ to: "/account", replace: true });
  }

  return (
    <div className="container-page flex justify-center py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your bag and profile live with your account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors["password"])}
            />
            {errors["password"] ? (
              <p className="text-xs text-destructive">{errors["password"][0]}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New to ACME?{" "}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

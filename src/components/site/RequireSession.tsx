import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/**
 * UI-level gate only. Every endpoint behind these screens re-checks the
 * caller's session and role on the server, so this is presentation, not
 * security.
 */
export function RequireSession({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="container-page py-16">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-6 h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container-page flex justify-center py-24">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <h1 className="text-2xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register">Create an account</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

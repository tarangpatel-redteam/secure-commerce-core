import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl font-semibold">ACME Commerce</p>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Considered hardware for desks, journeys and homes. Designed in-house, built to be
            repaired rather than replaced.
          </p>
        </div>
        <div>
          <p className="eyebrow">Shop</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/products" className="hover:text-foreground">
                All products
              </Link>
            </li>
            <li>
              <Link to="/products" search={{ category: "audio" }} className="hover:text-foreground">
                Audio
              </Link>
            </li>
            <li>
              <Link
                to="/products"
                search={{ category: "workspace" }}
                className="hover:text-foreground"
              >
                Workspace
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Account</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-foreground">
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/cart" className="hover:text-foreground">
                Your bag
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} ACME Commerce. All rights reserved.</p>
          <p>Synthetic catalogue used for a controlled internal environment.</p>
        </div>
      </div>
    </footer>
  );
}

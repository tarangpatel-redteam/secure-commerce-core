import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export type AppRole = "customer" | "employee" | "manager" | "administrator";

export type Account = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  marketingOptIn: boolean;
  memberSince: string | null;
  roles: AppRole[];
  primaryRole: AppRole;
};

export function useAccount(enabled: boolean) {
  return useQuery({
    queryKey: ["account"],
    queryFn: () => apiFetch<Account>("/me"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export const ROLE_LABEL: Record<AppRole, string> = {
  customer: "Customer",
  employee: "Employee",
  manager: "Manager",
  administrator: "Administrator",
};

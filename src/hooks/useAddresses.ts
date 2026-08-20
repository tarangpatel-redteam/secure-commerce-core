import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api-client";

export type Address = {
  id: string;
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
};

export type AddressPayload = {
  label: string;
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
};

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiFetch<Address[]>("/addresses"),
    enabled,
    retry: false,
  });
}

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useSaveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; values: AddressPayload }) =>
      input.id
        ? apiFetch<Address>(`/addresses/${input.id}`, { method: "PUT", body: input.values })
        : apiFetch<Address>("/addresses", { method: "POST", body: input.values }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success(variables.id ? "Address updated" : "Address saved");
    },
    onError: (error) => toast.error(message(error, "Unable to save that address.")),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/addresses/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address removed");
    },
    onError: (error) => toast.error(message(error, "Unable to remove that address.")),
  });
}

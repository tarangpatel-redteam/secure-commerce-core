import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api-client";

export type CartLine = {
  id: string;
  quantity: number;
  lineTotalCents: number;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    priceCents: number;
    currency: string;
    imageUrl: string | null;
    stockQuantity: number;
  };
};

export type Cart = {
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
};

export function useCart(enabled: boolean) {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => apiFetch<Cart>("/cart"),
    enabled,
    retry: false,
  });
}

function useCartWriter() {
  const queryClient = useQueryClient();
  return (cart: Cart) => queryClient.setQueryData(["cart"], cart);
}

export function useAddToCart() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number }) =>
      apiFetch<Cart>("/cart", { method: "POST", body: input }),
    onSuccess: (cart) => {
      write(cart);
      toast.success("Added to your bag");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Unable to add that item.");
    },
  });
}

export function useUpdateCartItem() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      apiFetch<Cart>(`/cart/items/${input.itemId}`, {
        method: "PATCH",
        body: { quantity: input.quantity },
      }),
    onSuccess: write,
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Unable to update your bag.");
    },
  });
}

export function useRemoveCartItem() {
  const write = useCartWriter();
  return useMutation({
    mutationFn: (itemId: string) => apiFetch<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),
    onSuccess: (cart) => {
      write(cart);
      toast.success("Removed from your bag");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Unable to update your bag.");
    },
  });
}

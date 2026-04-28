import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Favorite, InsertFavorite } from "@shared/schema";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useFavorites() {
  return useQuery<Favorite[]>({
    queryKey: [api.favorites.list.path],
    queryFn: async () => {
      const res = await fetch(api.favorites.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch favorites");
      const data = await res.json();
      return data;
    },
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (favorite: Omit<InsertFavorite, "userId">) => {
      // Mocking userId for MVP as requested
      const payload: InsertFavorite = { ...favorite, userId: 1 };
      
      const res = await fetch(api.favorites.create.path, {
        method: api.favorites.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to add favorite");
      const data = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.favorites.list.path] });
      toast({
        title: "Added to Favorites",
        description: "The code has been successfully saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not add to favorites. Please try again.",
        variant: "destructive",
      });
    }
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.favorites.delete.path, { id });
      const res = await fetch(url, {
        method: api.favorites.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove favorite");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.favorites.list.path] });
      toast({
        title: "Removed from Favorites",
        description: "The code has been removed from your list.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not remove favorite. Please try again.",
        variant: "destructive",
      });
    }
  });
}

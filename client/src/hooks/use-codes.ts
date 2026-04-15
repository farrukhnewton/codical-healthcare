import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useSearchCodes(query: string, type?: string) {
  return useQuery({
    queryKey: [api.codes.search.path, query, type],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (type && type !== "All") params.append("type", type);
      
      const res = await fetch(`${api.codes.search.path}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search codes");
      
      const data = await res.json();
      return data;
    },
    enabled: true, // Allow empty search to get default/initial list
  });
}

export function useCode(type: string, code: string) {
  return useQuery({
    queryKey: [api.codes.get.path, type, code],
    queryFn: async () => {
      const url = buildUrl(api.codes.get.path, { type, code });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch code details");
      
      const data = await res.json();
      return data;
    },
    enabled: !!type && !!code,
  });
}

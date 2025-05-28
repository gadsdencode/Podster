import { useMutation, useQuery } from "@tanstack/react-query";
import { searchApi } from "@/lib/api";
import type { SearchRequestPayload } from "@/types";
import type { SearchResult } from "@shared/schema";

export function useSearch() {
  return useMutation({
    mutationFn: (payload: SearchRequestPayload) => searchApi.search(payload),
  });
}

export function useRecentSearches(userId?: number) {
  return useQuery({
    queryKey: ["/api/search", "recent", userId],
    queryFn: async () => {
      // This would need a backend endpoint for recent searches
      // For now, return empty array
      return [];
    },
    enabled: !!userId,
  });
}

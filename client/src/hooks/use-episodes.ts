import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { episodesApi, statsApi } from "@/lib/api";
import type { Episode, InsertEpisode, SystemStats, EpisodeWithProgress } from "@shared/schema";

export function useEpisodes() {
  return useQuery({
    queryKey: ["/api/episodes"],
    queryFn: episodesApi.getAll,
    refetchInterval: 5000, // Refresh every 5 seconds to catch status updates
  });
}

export function useRecentEpisodes() {
  return useQuery({
    queryKey: ["/api/episodes", "recent"],
    queryFn: async () => {
      const episodes = await episodesApi.getAll();
      return episodes.slice(0, 6); // Return only the 6 most recent
    },
  });
}

export function useEpisode(id: number) {
  return useQuery({
    queryKey: ["/api/episodes", id],
    queryFn: () => episodesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (episode: InsertEpisode) => episodesApi.create(episode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}

export function useDeleteEpisode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => episodesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}

export function useUpdateTranscript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, transcript }: { id: number; transcript: string }) => 
      episodesApi.updateTranscript(id, transcript),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", variables.id] });
    },
  });
}

export function useProcessingStatus(episodeId: number) {
  return useQuery({
    queryKey: ["/api/processing-status", episodeId],
    queryFn: () => episodesApi.getProcessingStatus(episodeId),
    enabled: !!episodeId,
    refetchInterval: (query) => {
      // Poll every 500ms for real-time updates when processing
      if (query.state.data?.status === "processing") {
        return 500;
      }
      // Continue polling for a few seconds after completion to show final state
      if (query.state.data?.status === "completed" || query.state.data?.status === "failed") {
        return 3000;
      }
      return false;
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache old data
  });
}

export function useProcessEpisode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, options }: { id: number; options?: { generateSummary?: boolean; extractTopics?: boolean } }) => 
      episodesApi.process(id, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/processing-status", variables.id] });
    },
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: ["/api/stats"],
    queryFn: statsApi.getSystemStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useBatchProcess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ urls, extractionMethod }: { urls: string[]; extractionMethod: string }) => 
      episodesApi.batchProcess(urls, extractionMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });
}

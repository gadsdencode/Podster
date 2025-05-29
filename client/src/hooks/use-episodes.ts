import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { episodesApi, statsApi } from "@/lib/api";
import type { Episode, InsertEpisode, SystemStats, EpisodeWithProgress } from "@shared/schema";
import { useWebSocket, type ProcessingUpdate } from "./use-websocket";
import { useEffect } from "react";

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
    refetchInterval: 2000, // Refresh every 2 seconds for more responsive UI
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
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
    // Use a more specific mutation key to avoid conflicts
    mutationKey: ['deleteEpisode'],
    
    mutationFn: async (id: number) => {
      try {
        const response = await episodesApi.delete(id);
        return response;
      } catch (error: any) {
        // Extract the error message from the API response if available
        const errorData = error.response?.data;
        throw new Error(errorData?.message || errorData?.error || 'Failed to delete episode');
      }
    },
    
    onSuccess: () => {
      // Only invalidate queries on success
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    
    // Only retry once to avoid multiple error notifications
    retry: 0
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
  const { subscribeToEpisode, isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  
  // Fallback to polling if WebSocket not connected
  const pollingQuery = useQuery({
    queryKey: ["/api/processing-status", episodeId],
    queryFn: () => episodesApi.getProcessingStatus(episodeId),
    enabled: !!episodeId && !isConnected,
    refetchInterval: (query) => {
      // Poll every 2000ms for fallback when WebSocket is not available
      if (query.state.data?.status === "processing") {
        return 2000;
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
  
  // Initial data fetch for WebSocket mode
  const initialQuery = useQuery({
    queryKey: ["/api/processing-status", episodeId],
    queryFn: () => episodesApi.getProcessingStatus(episodeId),
    enabled: !!episodeId && isConnected,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });
  
  // WebSocket real-time updates
  useEffect(() => {
    if (!isConnected || !episodeId) return;
    
    console.log('Setting up WebSocket subscription for episode:', episodeId);
    
    const unsubscribe = subscribeToEpisode(episodeId, (update: ProcessingUpdate) => {
      console.log('Received WebSocket update for episode:', episodeId, update);
      
      // Update the query cache with real-time data
      queryClient.setQueryData(["/api/processing-status", episodeId], (old: any) => ({
        ...old,
        ...update,
        // Ensure we preserve the episode ID
        id: episodeId
      }));
      
      // Also update the episodes list if this is a significant update
      if (update.status || update.progress === 100) {
        queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/episodes", "recent"] });
      }
    });
    
    return unsubscribe;
  }, [episodeId, isConnected, subscribeToEpisode, queryClient]);
  
  // Return WebSocket data if connected, otherwise polling data
  if (isConnected) {
    const cachedData = queryClient.getQueryData(["/api/processing-status", episodeId]) as EpisodeWithProgress | undefined;
    return {
      ...initialQuery,
      data: cachedData || initialQuery.data,
      isLoading: !cachedData && initialQuery.isLoading,
    };
  }
  
  return pollingQuery;
}

export function useProcessEpisode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, options }: { id: number; options?: { generateSummary?: boolean; extractTopics?: boolean } }) => 
      episodesApi.process(id, options),
    onSuccess: (_, variables) => {
      // Invalidate all necessary queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] }); // Invalidate all episodes
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", variables.id] }); // Invalidate specific episode
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", "recent"] }); // Invalidate recent episodes
      queryClient.invalidateQueries({ queryKey: ["/api/processing-status", variables.id] }); // Invalidate processing status
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); // Invalidate stats
      
      // Force a refetch of recent episodes immediately
      queryClient.refetchQueries({ queryKey: ["/api/episodes", "recent"] });
    },
  });
}

export function useSystemStats() {
  const { subscribeToSystem, isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  
  // WebSocket real-time updates for stats
  useEffect(() => {
    if (!isConnected) return;
    
    console.log('Setting up WebSocket subscription for system stats');
    
    const unsubscribe = subscribeToSystem((event: string, data: any) => {
      console.log('Received system update:', event, data);
      
      if (event === 'stats-updated') {
        // Update the stats cache with real-time data
        queryClient.setQueryData(["/api/stats"], data);
      }
    });
    
    return unsubscribe;
  }, [isConnected, subscribeToSystem, queryClient]);
  
  return useQuery({
    queryKey: ["/api/stats"],
    queryFn: statsApi.getSystemStats,
    refetchInterval: isConnected ? false : 5000, // Only poll if WebSocket not connected
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
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

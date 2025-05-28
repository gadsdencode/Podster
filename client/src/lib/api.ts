import { apiRequest } from "./queryClient";
import type { 
  Episode, 
  InsertEpisode, 
  User, 
  InsertUser,
  SearchResult,
  SystemStats,
  EpisodeWithProgress 
} from "@shared/schema";
import type { SearchRequestPayload } from "@/types";

export const episodesApi = {
  getAll: async (): Promise<Episode[]> => {
    const response = await apiRequest("GET", "/api/episodes");
    return response.json();
  },

  getById: async (id: number): Promise<Episode> => {
    const response = await apiRequest("GET", `/api/episodes/${id}`);
    return response.json();
  },

  getByVideoId: async (videoId: string): Promise<Episode> => {
    const response = await apiRequest("GET", `/api/episodes/${videoId}`);
    return response.json();
  },

  create: async (episode: InsertEpisode): Promise<Episode> => {
    const response = await apiRequest("POST", "/api/episodes", episode);
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/episodes/${id}`);
  },

  updateTranscript: async (id: number, transcript: string): Promise<Episode> => {
    const response = await apiRequest("PUT", `/api/episodes/${id}/transcript`, { transcript });
    return response.json();
  },

  getProcessingStatus: async (id: number): Promise<EpisodeWithProgress> => {
    const response = await apiRequest("GET", `/api/processing-status/${id}`);
    return response.json();
  },

  process: async (id: number, options?: { generateSummary?: boolean; extractTopics?: boolean }): Promise<void> => {
    await apiRequest("POST", `/api/process/${id}`, options);
  },

  batchProcess: async (urls: string[], extractionMethod: string): Promise<any> => {
    const response = await apiRequest("POST", "/api/batch-process", { urls, extractionMethod });
    return response.json();
  }
};

export const searchApi = {
  search: async (payload: SearchRequestPayload): Promise<{ results: SearchResult[]; totalResults: number }> => {
    const response = await apiRequest("POST", "/api/search", payload);
    return response.json();
  }
};

export const statsApi = {
  getSystemStats: async (): Promise<SystemStats> => {
    const response = await apiRequest("GET", "/api/stats");
    return response.json();
  }
};

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await apiRequest("GET", "/api/admin/users");
    return response.json();
  },

  create: async (user: InsertUser): Promise<User> => {
    const response = await apiRequest("POST", "/api/admin/users", user);
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/admin/users/${id}`);
  },

  changePassword: async (userId: number, currentPassword: string, newPassword: string): Promise<void> => {
    await apiRequest("POST", "/api/admin/change_password", {
      userId,
      currentPassword,
      newPassword
    });
  }
};

export const authApi = {
  login: async (username: string, password: string): Promise<{ user: User; token: string }> => {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    return response.json();
  }
};

export const enrichmentApi = {
  enrich: async (episodeId: number, generateSummary: boolean, extractTopics: boolean): Promise<Episode> => {
    const response = await apiRequest("POST", "/api/enrich", {
      episodeId,
      generateSummary,
      extractTopics
    });
    return response.json();
  }
};

export const exportApi = {
  exportData: async (format: 'json' | 'csv'): Promise<Blob> => {
    const response = await apiRequest("GET", `/api/export/${format}`);
    return response.blob();
  }
};

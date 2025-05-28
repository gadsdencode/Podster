import { 
  users, episodes, searchQueries, processingQueue,
  type User, type InsertUser, type Episode, type InsertEpisode,
  type SearchQuery, type InsertSearchQuery, type ProcessingQueueItem,
  type SystemStats, type SearchResult
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Episode management
  getEpisode(id: number): Promise<Episode | undefined>;
  getEpisodeByVideoId(videoId: string): Promise<Episode | undefined>;
  createEpisode(episode: InsertEpisode): Promise<Episode>;
  updateEpisode(id: number, updates: Partial<Episode>): Promise<Episode | undefined>;
  deleteEpisode(id: number): Promise<boolean>;
  getAllEpisodes(userId?: number): Promise<Episode[]>;
  getEpisodesByStatus(status: string): Promise<Episode[]>;

  // Search functionality
  searchTranscripts(query: string, userId?: number): Promise<SearchResult[]>;
  createSearchQuery(searchQuery: InsertSearchQuery): Promise<SearchQuery>;
  getRecentSearches(userId: number, limit?: number): Promise<SearchQuery[]>;

  // Processing queue
  addToQueue(episodeId: number, priority?: number): Promise<ProcessingQueueItem>;
  getQueueItems(): Promise<ProcessingQueueItem[]>;
  updateQueueItem(id: number, updates: Partial<ProcessingQueueItem>): Promise<ProcessingQueueItem | undefined>;
  removeFromQueue(id: number): Promise<boolean>;

  // Analytics
  getSystemStats(): Promise<SystemStats>;
  getUserStats(userId: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private episodes: Map<number, Episode>;
  private searchQueries: Map<number, SearchQuery>;
  private processingQueue: Map<number, ProcessingQueueItem>;
  private currentUserId: number;
  private currentEpisodeId: number;
  private currentSearchId: number;
  private currentQueueId: number;

  constructor() {
    this.users = new Map();
    this.episodes = new Map();
    this.searchQueries = new Map();
    this.processingQueue = new Map();
    this.currentUserId = 1;
    this.currentEpisodeId = 1;
    this.currentSearchId = 1;
    this.currentQueueId = 1;

    // Create default admin user
    this.createUser({
      username: "admin",
      email: "admin@transcriptai.com",
      password: "$2b$10$defaulthashedpassword", // In real app, this would be properly hashed
      role: "admin"
    });
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "user",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Episode management
  async getEpisode(id: number): Promise<Episode | undefined> {
    return this.episodes.get(id);
  }

  async getEpisodeByVideoId(videoId: string): Promise<Episode | undefined> {
    return Array.from(this.episodes.values()).find(episode => episode.videoId === videoId);
  }

  async createEpisode(insertEpisode: InsertEpisode): Promise<Episode> {
    const id = this.currentEpisodeId++;
    const episode: Episode = {
      ...insertEpisode,
      id,
      status: "pending",
      createdAt: new Date(),
      processingStarted: null,
      processingCompleted: null,
      transcript: null,
      summary: null,
      topics: [],
      wordCount: null,
      errorMessage: null,
      // These will be populated by the video info extraction
      videoId: "",
      title: "",
      description: null,
      channel: null,
      duration: null,
      thumbnailUrl: null
    };
    this.episodes.set(id, episode);
    return episode;
  }

  async updateEpisode(id: number, updates: Partial<Episode>): Promise<Episode | undefined> {
    const episode = this.episodes.get(id);
    if (!episode) return undefined;
    
    const updatedEpisode = { ...episode, ...updates };
    this.episodes.set(id, updatedEpisode);
    return updatedEpisode;
  }

  async deleteEpisode(id: number): Promise<boolean> {
    return this.episodes.delete(id);
  }

  async getAllEpisodes(userId?: number): Promise<Episode[]> {
    const allEpisodes = Array.from(this.episodes.values());
    if (userId) {
      return allEpisodes.filter(episode => episode.userId === userId);
    }
    return allEpisodes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getEpisodesByStatus(status: string): Promise<Episode[]> {
    return Array.from(this.episodes.values()).filter(episode => episode.status === status);
  }

  // Search functionality
  async searchTranscripts(query: string, userId?: number): Promise<SearchResult[]> {
    const episodes = userId ? 
      Array.from(this.episodes.values()).filter(ep => ep.userId === userId) :
      Array.from(this.episodes.values());
    
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    
    for (const episode of episodes) {
      if (!episode.transcript) continue;
      
      const transcript = episode.transcript.toLowerCase();
      const title = episode.title.toLowerCase();
      
      if (transcript.includes(queryLower) || title.includes(queryLower)) {
        // Simple highlighting - in real app would use more sophisticated text search
        const highlights = [];
        const sentences = episode.transcript.split(/[.!?]+/);
        
        for (let i = 0; i < sentences.length; i++) {
          if (sentences[i].toLowerCase().includes(queryLower)) {
            highlights.push({
              segment: sentences[i].trim(),
              timestamp: `${Math.floor(i * 30 / 60)}:${(i * 30 % 60).toString().padStart(2, '0')}`,
              matchScore: 0.8
            });
          }
        }
        
        if (highlights.length > 0) {
          results.push({
            episode,
            highlights: highlights.slice(0, 3), // Limit to 3 highlights
            totalMatches: highlights.length
          });
        }
      }
    }
    
    return results.sort((a, b) => b.totalMatches - a.totalMatches);
  }

  async createSearchQuery(insertSearchQuery: InsertSearchQuery): Promise<SearchQuery> {
    const id = this.currentSearchId++;
    const searchQuery: SearchQuery = {
      ...insertSearchQuery,
      id,
      userId: insertSearchQuery.userId || null,
      resultCount: insertSearchQuery.resultCount || 0,
      createdAt: new Date()
    };
    this.searchQueries.set(id, searchQuery);
    return searchQuery;
  }

  async getRecentSearches(userId: number, limit = 10): Promise<SearchQuery[]> {
    return Array.from(this.searchQueries.values())
      .filter(query => query.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Processing queue
  async addToQueue(episodeId: number, priority = 0): Promise<ProcessingQueueItem> {
    const id = this.currentQueueId++;
    const queueItem: ProcessingQueueItem = {
      id,
      episodeId,
      priority,
      attempts: 0,
      maxAttempts: 3,
      status: "queued",
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };
    this.processingQueue.set(id, queueItem);
    return queueItem;
  }

  async getQueueItems(): Promise<ProcessingQueueItem[]> {
    return Array.from(this.processingQueue.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.createdAt.getTime() - b.createdAt.getTime());
  }

  async updateQueueItem(id: number, updates: Partial<ProcessingQueueItem>): Promise<ProcessingQueueItem | undefined> {
    const item = this.processingQueue.get(id);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...updates };
    this.processingQueue.set(id, updatedItem);
    return updatedItem;
  }

  async removeFromQueue(id: number): Promise<boolean> {
    return this.processingQueue.delete(id);
  }

  // Analytics
  async getSystemStats(): Promise<SystemStats> {
    const allEpisodes = Array.from(this.episodes.values());
    const completedEpisodes = allEpisodes.filter(ep => ep.status === "completed");
    const failedEpisodes = allEpisodes.filter(ep => ep.status === "failed");
    const queueLength = Array.from(this.processingQueue.values()).filter(item => item.status === "queued").length;
    
    const successRate = allEpisodes.length > 0 ? 
      (completedEpisodes.length / (completedEpisodes.length + failedEpisodes.length)) * 100 : 100;
    
    const methodDistribution = {
      caption: allEpisodes.filter(ep => ep.extractionMethod === "caption").length,
      scraping: allEpisodes.filter(ep => ep.extractionMethod === "scraping").length,
      audio: allEpisodes.filter(ep => ep.extractionMethod === "audio").length
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyProcessed = allEpisodes.filter(ep => 
      ep.createdAt >= today && ep.status === "completed"
    ).length;
    
    return {
      totalEpisodes: allEpisodes.length,
      processingQueue: queueLength,
      successRate: Math.round(successRate * 10) / 10,
      averageProcessingTime: "2.3min",
      totalStorage: "15.2GB",
      dailyProcessed,
      methodDistribution
    };
  }

  async getUserStats(userId: number): Promise<any> {
    const userEpisodes = Array.from(this.episodes.values()).filter(ep => ep.userId === userId);
    const userSearches = Array.from(this.searchQueries.values()).filter(sq => sq.userId === userId);
    
    return {
      totalEpisodes: userEpisodes.length,
      completedEpisodes: userEpisodes.filter(ep => ep.status === "completed").length,
      totalSearches: userSearches.length,
      recentActivity: userEpisodes.slice(0, 5)
    };
  }
}

export const storage = new MemStorage();

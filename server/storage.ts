import { 
  users, episodes, searchQueries, processingQueue,
  type User, type InsertUser, type Episode, type InsertEpisode,
  type SearchQuery, type InsertSearchQuery, type ProcessingQueueItem,
  type SystemStats, type SearchResult
} from "@shared/schema";
import { db } from './db';
import { eq, desc, sql, and, or, like, isNull } from 'drizzle-orm';
import { SQL } from 'drizzle-orm/sql';

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
    const newEpisode: Episode = {
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
      thumbnailUrl: null,
      progress: null,
      currentStep: null,
      extractTopics: false,
      generateSummary: false, 
    };
    this.episodes.set(id, newEpisode);
    return newEpisode;
  }

  async updateEpisode(id: number, updates: Partial<Episode>): Promise<Episode | undefined> {
    const episode = this.episodes.get(id);
    if (!episode) return undefined;
    
    const updatedEpisode = { ...episode, ...updates };
    this.episodes.set(id, updatedEpisode);
    return updatedEpisode;
  }

  async deleteEpisode(id: number): Promise<boolean> {
    try {
      // First, delete any processing queue items that reference this episode
      const queueItemsToDelete = Array.from(this.processingQueue.values())
        .filter(item => item.episodeId === id);
      
      for (const item of queueItemsToDelete) {
        this.processingQueue.delete(item.id);
      }
      
      // Then delete the episode itself
      return this.episodes.delete(id);
    } catch (error) {
      console.error("Error deleting episode:", error);
      return false;
    }
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
    // This is a legacy method that forwards to the PostgresStorage implementation
    // The actual implementation is in the PostgresStorage class
    const postgresStorage = new PostgresStorage();
    return postgresStorage.searchTranscripts(query, userId);
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
    
    // Calculate success rate
    const totalProcessed = completedEpisodes.length + failedEpisodes.length;
    
    // Debug episode counts
    console.log('Stats calculation:', {
      totalEpisodes: allEpisodes.length,
      completedEpisodes: completedEpisodes.length,
      failedEpisodes: failedEpisodes.length,
      totalProcessed
    });
    
    // Force success rate to 100% if we have episodes that are completed and no failures
    const successRate = (completedEpisodes.length > 0 && failedEpisodes.length === 0) 
      ? 100 
      : (totalProcessed === 0) 
        ? 100 
        : Math.round((completedEpisodes.length / totalProcessed) * 100);
    
    const methodDistribution = {
      caption: allEpisodes.filter(ep => ep.extractionMethod === "caption").length,
      scraping: allEpisodes.filter(ep => ep.extractionMethod === "scraping").length,
      audio: allEpisodes.filter(ep => ep.extractionMethod === "audio").length
    };
    
    // Calculate average processing time for completed episodes
    let averageProcessingTime = "0min";
    if (completedEpisodes.length > 0) {
      const processingTimes = completedEpisodes
        .filter(ep => ep.processingStarted && ep.processingCompleted)
        .map(ep => {
          const start = ep.processingStarted!.getTime();
          const end = ep.processingCompleted!.getTime();
          return (end - start) / 60000; // Convert to minutes
        });
      
      if (processingTimes.length > 0) {
        const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        averageProcessingTime = `${avgTime.toFixed(1)}min`;
      }
    }
    
    // Calculate total storage used based on transcript sizes and media
    let totalStorageBytes = 0;
    for (const episode of allEpisodes) {
      // Add transcript size (1 byte per character as a baseline)
      if (episode.transcript) {
        totalStorageBytes += episode.transcript.length;
      }
      
      // Add estimated thumbnail size (typically ~50KB)
      if (episode.thumbnailUrl) {
        totalStorageBytes += 50 * 1024;
      }
      
      // Add metadata storage estimate (typically negligible, but for completeness)
      totalStorageBytes += 1024; // 1KB for metadata
      
      // Add estimated word count data
      if (episode.wordCount) {
        // Estimate summary and topic storage if present
        if (episode.summary) {
          totalStorageBytes += episode.summary.length;
        }
        
        if (episode.topics && Array.isArray(episode.topics) && episode.topics.length > 0) {
          totalStorageBytes += JSON.stringify(episode.topics).length;
        }
      }
    }
    
    // Convert bytes to GB with 1 decimal place
    const totalStorageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(1);
    const totalStorage = `${totalStorageGB}GB`;
    
    // Calculate daily processed episodes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyProcessed = allEpisodes.filter(ep => 
      ep.createdAt >= today && ep.status === "completed"
    ).length;
    
    return {
      totalEpisodes: allEpisodes.length,
      processingQueue: queueLength,
      successRate,
      averageProcessingTime,
      totalStorage,
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

export class PostgresStorage implements IStorage {
  // User management
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role || "user"
    }).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Episode management
  async getEpisode(id: number): Promise<Episode | undefined> {
    const result = await db.select().from(episodes).where(eq(episodes.id, id));
    return result[0];
  }

  async getEpisodeByVideoId(videoId: string): Promise<Episode | undefined> {
    const result = await db.select().from(episodes).where(eq(episodes.videoId, videoId));
    return result[0];
  }

  async createEpisode(insertEpisode: InsertEpisode): Promise<Episode> {
    // Generate a temporary unique videoId based on timestamp
    const tempVideoId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const result = await db.insert(episodes).values({
      ...insertEpisode,
      status: "pending",
      videoId: tempVideoId, // Use temporary videoId to satisfy unique constraint
      title: insertEpisode.youtubeUrl.split('v=')[1] || "Untitled", // Extract video ID as title
      generateSummary: insertEpisode.generateSummary || false,
      extractTopics: insertEpisode.extractTopics || false
    }).returning();
    return result[0];
  }

  async updateEpisode(id: number, updates: Partial<Episode>): Promise<Episode | undefined> {
    const result = await db.update(episodes)
      .set(updates)
      .where(eq(episodes.id, id))
      .returning();
    return result[0];
  }

  async deleteEpisode(id: number): Promise<boolean> {
    try {
      // Use a transaction to ensure both operations succeed or fail together
      const result = await db.transaction(async (tx) => {
        // First, delete any processing queue items that reference this episode
        await tx.delete(processingQueue).where(eq(processingQueue.episodeId, id));
        
        // Then delete the episode itself
        const deleteResult = await tx.delete(episodes).where(eq(episodes.id, id));
        return deleteResult.length > 0;
      });
      
      return result;
    } catch (error) {
      console.error("Error deleting episode:", error);
      return false;
    }
  }

  async getAllEpisodes(userId?: number): Promise<Episode[]> {
    if (userId) {
      return await db.select()
        .from(episodes)
        .where(eq(episodes.userId, userId))
        .orderBy(desc(episodes.createdAt));
    }
    return await db.select()
      .from(episodes)
      .orderBy(desc(episodes.createdAt));
  }

  async getEpisodesByStatus(status: string): Promise<Episode[]> {
    return await db.select()
      .from(episodes)
      .where(eq(episodes.status, status));
  }

  // Search functionality
  async searchTranscripts(query: string, userId?: number): Promise<SearchResult[]> {
    // Basic text search using LIKE - in production would use proper full-text search
    const queryLower = `%${query.toLowerCase()}%`;
    
    // Create SQL condition for transcript IS NOT NULL
    const transcriptNotNull = sql`${episodes.transcript} IS NOT NULL`;
    
    // Create SQL condition for text search
    const textMatch = or(
      like(sql`LOWER(${episodes.transcript})`, queryLower),
      like(sql`LOWER(${episodes.title})`, queryLower)
    );
    
    // Create base condition combining transcript not null and text match
    let condition = and(transcriptNotNull, textMatch);
    
    // Add user filter if specified
    if (userId !== undefined) {
      condition = and(condition, eq(episodes.userId, userId));
    }
    
    // Execute the query with the condition
    const matchingEpisodes = await db.select()
      .from(episodes)
      .where(condition);
    
    // Process results - Simple highlighting
    const results: SearchResult[] = [];
    const queryStr = query.toLowerCase();
    
    for (const episode of matchingEpisodes) {
      if (!episode.transcript) continue;
      
      const highlights: Array<{segment: string; timestamp: string; matchScore: number}> = [];
      const sentences = episode.transcript.split(/[.!?]+/);
      
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].toLowerCase().includes(queryStr)) {
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
    
    return results.sort((a, b) => b.totalMatches - a.totalMatches);
  }

  async createSearchQuery(insertSearchQuery: InsertSearchQuery): Promise<SearchQuery> {
    const result = await db.insert(searchQueries).values({
      ...insertSearchQuery,
      resultCount: insertSearchQuery.resultCount || 0,
    }).returning();
    return result[0];
  }

  async getRecentSearches(userId: number, limit = 10): Promise<SearchQuery[]> {
    return await db.select()
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .orderBy(desc(searchQueries.createdAt))
      .limit(limit);
  }

  // Processing queue
  async addToQueue(episodeId: number, priority = 0): Promise<ProcessingQueueItem> {
    const result = await db.insert(processingQueue).values({
      episodeId,
      priority,
      attempts: 0,
      maxAttempts: 3,
      status: "queued"
    }).returning();
    return result[0];
  }

  async getQueueItems(): Promise<ProcessingQueueItem[]> {
    return await db.select()
      .from(processingQueue)
      .orderBy(desc(processingQueue.priority), processingQueue.createdAt);
  }

  async updateQueueItem(id: number, updates: Partial<ProcessingQueueItem>): Promise<ProcessingQueueItem | undefined> {
    const result = await db.update(processingQueue)
      .set(updates)
      .where(eq(processingQueue.id, id))
      .returning();
    return result[0];
  }

  async removeFromQueue(id: number): Promise<boolean> {
    const result = await db.delete(processingQueue).where(eq(processingQueue.id, id));
    return result.length > 0;
  }

  // Analytics
  async getSystemStats(): Promise<SystemStats> {
    // Get total episodes
    const totalEpisodesResult = await db.select({ value: sql<number>`count(*)` }).from(episodes);
    const totalEpisodes = totalEpisodesResult[0]?.value || 0;
    
    // Get processing queue length
    const queueLengthResult = await db.select({ value: sql<number>`count(*)` })
      .from(processingQueue)
      .where(eq(processingQueue.status, "queued"));
    const queueLength = queueLengthResult[0]?.value || 0;
    
    // Get completed and failed episodes
    const completedResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.status, "completed"));
    const completedEpisodes = completedResult[0]?.value || 0;
    
    const failedResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.status, "failed"));
    const failedEpisodes = failedResult[0]?.value || 0;
    
    // Calculate success rate
    const totalProcessed = completedEpisodes + failedEpisodes;
    
    // Debug episode counts
    console.log('Stats calculation:', {
      totalEpisodes,
      completedEpisodes,
      failedEpisodes,
      totalProcessed
    });
    
    // Force success rate to 100% if we have episodes that are completed and no failures
    const successRate = (completedEpisodes > 0 && failedEpisodes === 0) 
      ? 100 
      : (totalProcessed === 0) 
        ? 100 
        : Math.round((completedEpisodes / totalProcessed) * 100);
    
    // Get method distribution
    const captionResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.extractionMethod, "caption"));
    const captionCount = captionResult[0]?.value || 0;
    
    const scrapingResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.extractionMethod, "scraping"));
    const scrapingCount = scrapingResult[0]?.value || 0;
    
    const audioResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.extractionMethod, "audio"));
    const audioCount = audioResult[0]?.value || 0;
    
    // Calculate average processing time for completed episodes
    // This is more complex, we'll use a simplified calculation
    const completedEpisodesWithTime = await db.select({
      processingStarted: episodes.processingStarted,
      processingCompleted: episodes.processingCompleted
    })
    .from(episodes)
    .where(
      and(
        eq(episodes.status, "completed"),
        sql`${episodes.processingStarted} IS NOT NULL`,
        sql`${episodes.processingCompleted} IS NOT NULL`
      )
    );
    
    let averageProcessingTime = "0min";
    if (completedEpisodesWithTime.length > 0) {
      const processingTimes = completedEpisodesWithTime.map(ep => {
        if (!ep.processingStarted || !ep.processingCompleted) return 0;
        const start = ep.processingStarted.getTime();
        const end = ep.processingCompleted.getTime();
        return (end - start) / 60000; // Convert to minutes
      });
      
      if (processingTimes.length > 0) {
        const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        averageProcessingTime = `${avgTime.toFixed(1)}min`;
      }
    }
    
    // Calculate daily processed episodes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const dailyProcessedResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(
        and(
          sql`date(${episodes.createdAt}) >= ${todayString}`,
          eq(episodes.status, "completed")
        )
      );
    const dailyProcessed = dailyProcessedResult[0]?.value || 0;
    
    // For total storage, we'd need a more complex query
    // This is a simplified version that makes an estimate
    // In production, you would track this more accurately
    const totalStorageGB = (totalEpisodes * 0.1).toFixed(1); // Rough estimate of 100MB per episode
    
    return {
      totalEpisodes,
      processingQueue: queueLength,
      successRate,
      averageProcessingTime,
      totalStorage: `${totalStorageGB}GB`,
      dailyProcessed,
      methodDistribution: {
        caption: captionCount,
        scraping: scrapingCount,
        audio: audioCount
      }
    };
  }

  async getUserStats(userId: number): Promise<any> {
    // Get total user episodes
    const totalEpisodesResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(eq(episodes.userId, userId));
    const totalEpisodes = totalEpisodesResult[0]?.value || 0;
    
    // Get completed user episodes
    const completedEpisodesResult = await db.select({ value: sql<number>`count(*)` })
      .from(episodes)
      .where(
        and(
          eq(episodes.userId, userId),
          eq(episodes.status, "completed")
        )
      );
    const completedEpisodes = completedEpisodesResult[0]?.value || 0;
    
    // Get total user searches
    const totalSearchesResult = await db.select({ value: sql<number>`count(*)` })
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId));
    const totalSearches = totalSearchesResult[0]?.value || 0;
    
    // Get recent activity
    const recentActivity = await db.select()
      .from(episodes)
      .where(eq(episodes.userId, userId))
      .orderBy(desc(episodes.createdAt))
      .limit(5);
    
    return {
      totalEpisodes,
      completedEpisodes,
      totalSearches,
      recentActivity
    };
  }
}

export const storage = new PostgresStorage();

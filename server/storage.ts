import { 
  users, episodes, searchQueries, processingQueue,
  type User, type InsertUser, type Episode, type InsertEpisode,
  type SearchQuery, type InsertSearchQuery, type ProcessingQueueItem,
  type SystemStats, type SearchResult, admin
} from "@shared/schema";
import { db } from './db';
import { eq, desc, sql, and, or, like, isNull } from 'drizzle-orm';
import { SQL } from 'drizzle-orm/sql';
import type { AdminLogin } from "@shared/schema";

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

  // Admin Authentication
  verifyAdminCredentials(credentials: AdminLogin): Promise<boolean>;
}

export interface AdminCredentials {
  username: string;
  password: string;
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
      keywords: [],
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
      extractKeywords: false,
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
    try {
      // Get all episodes
      const allEpisodes = Array.from(this.episodes.values());
      const completedEpisodes = allEpisodes.filter(ep => ep.status === "completed");
      const failedEpisodes = allEpisodes.filter(ep => ep.status === "failed");
      const queueLength = Array.from(this.processingQueue.values()).filter(item => item.status === "queued").length;
      
      // Calculate success rate
      const totalProcessed = completedEpisodes.length + failedEpisodes.length;
      const successRate = totalProcessed === 0 ? 100 : Math.round((completedEpisodes.length / totalProcessed) * 100);
      
      const methodDistribution = {
        caption: allEpisodes.filter(ep => ep.extractionMethod === "caption").length,
        scraping: allEpisodes.filter(ep => ep.extractionMethod === "scraping").length,
        audio: allEpisodes.filter(ep => ep.extractionMethod === "audio").length
      };
      
      // Calculate average processing time
      let averageProcessingTime = "0min";
      if (completedEpisodes.length > 0) {
        const processingTimes = completedEpisodes
          .filter(ep => ep.processingStarted && ep.processingCompleted)
          .map(ep => {
            if (!ep.processingStarted || !ep.processingCompleted) return 0;
            return (new Date(ep.processingCompleted).getTime() - new Date(ep.processingStarted).getTime()) / 60000;
          })
          .filter(time => time > 0);
        
        if (processingTimes.length > 0) {
          const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
          averageProcessingTime = `${avgTime.toFixed(1)}min`;
        }
      }
      
      // Calculate total word count
      let totalWordCount = 0;
      for (const episode of allEpisodes) {
        if (episode.wordCount) {
          totalWordCount += episode.wordCount;
        } else if (episode.transcript) {
          // If wordCount not set but transcript exists, calculate it
          const wordCount = episode.transcript.split(/\s+/).length;
          totalWordCount += wordCount;
          
          // Update episode with the calculated word count
          await this.updateEpisode(episode.id, { wordCount });
        }
      }
      
      // Format total word count with comma separators
      const formattedWordCount = totalWordCount.toLocaleString();
      
      // Calculate daily processed episodes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyProcessed = allEpisodes.filter(ep => 
        ep.createdAt >= today && ep.status === "completed"
      ).length;
      
      // Simple trend calculation
      const episodesTrend = 5; // Placeholder value
      const wordCountTrend = 10; // Placeholder value
      
      // Generate history data
      const historySize = 20;
      const episodesHistory: number[] = [];
      const processingTimeHistory: number[] = [];
      const wordCountHistory: number[] = [];
      
      for (let i = 0; i < historySize; i++) {
        const ratio = (i + 1) / historySize;
        episodesHistory.push(Math.round(allEpisodes.length * ratio));
        processingTimeHistory.push(i + 1);
        wordCountHistory.push(Math.round(totalWordCount * ratio));
      }
      
      return {
        totalEpisodes: allEpisodes.length,
        processingQueue: queueLength,
        successRate,
        averageProcessingTime,
        totalWordCount: formattedWordCount,
        dailyProcessed,
        methodDistribution,
        trends: {
          totalEpisodes: episodesTrend,
          successRate: 0,
          processingTime: 0,
          wordCount: wordCountTrend
        },
        history: {
          totalEpisodes: episodesHistory,
          processingTime: processingTimeHistory,
          wordCount: wordCountHistory
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error getting system stats:", error);
      // Return default values if there's an error
      return {
        totalEpisodes: 0,
        processingQueue: 0,
        successRate: 100,
        averageProcessingTime: "0min",
        totalWordCount: "0",
        dailyProcessed: 0,
        methodDistribution: { caption: 0, scraping: 0, audio: 0 },
        trends: {
          totalEpisodes: 0,
          successRate: 0,
          processingTime: 0,
          wordCount: 0
        },
        history: {
          totalEpisodes: [],
          processingTime: [],
          wordCount: []
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }
  
  // Helper methods for MemStorage
  private calculateTrend(data: any[], dateField: string, daysToCompare: number): number {
    if (data.length === 0) return 0;
    
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysToCompare);
    
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - daysToCompare);
    
    const currentPeriod = data.filter(item => 
      item[dateField] && new Date(item[dateField]) >= periodStart && new Date(item[dateField]) <= now
    ).length;
    
    const previousPeriod = data.filter(item => 
      item[dateField] && new Date(item[dateField]) >= previousStart && new Date(item[dateField]) < periodStart
    ).length;
    
    if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
    
    const percentChange = Math.round(((currentPeriod - previousPeriod) / previousPeriod) * 100);
    return percentChange;
  }
  
  private calculateWordCountTrend(data: any[], daysToCompare: number): number {
    if (data.length === 0) return 0;
    
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysToCompare);
    
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - daysToCompare);
    
    const currentPeriod = data.filter(item => 
      item.createdAt && new Date(item.createdAt) >= periodStart && new Date(item.createdAt) <= now
    ).reduce((sum, item) => sum + (item.wordCount || 0), 0);
    
    const previousPeriod = data.filter(item => 
      item.createdAt && new Date(item.createdAt) >= previousStart && new Date(item.createdAt) < periodStart
    ).reduce((sum, item) => sum + (item.wordCount || 0), 0);
    
    if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
    
    const percentChange = Math.round(((currentPeriod - previousPeriod) / previousPeriod) * 100);
    return percentChange;
  }
  
  private calculateHistoryPoints(data: any[], field: string, points: number): number[] {
    // Sort data by created date
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    
    // Create evenly spaced points for the chart
    const result: number[] = [];
    if (sortedData.length === 0) {
      return Array(points).fill(0);
    }
    
    // Generate cumulative counts at different points in time
    const interval = sortedData.length / points;
    for (let i = 0; i < points; i++) {
      const index = Math.min(Math.floor(i * interval), sortedData.length - 1);
      if (field === 'id') {
        // For episode count, use cumulative count at this point
        result.push(index + 1);
      } else {
        // For other metrics, count items up to this point
        const count = sortedData.slice(0, index + 1).length;
        result.push(count);
      }
    }
    
    return result;
  }
  
  private calculateWordCountHistory(data: any[], points: number): number[] {
    // Sort data by created date
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
    
    // Create evenly spaced points for the chart
    const result: number[] = [];
    if (sortedData.length === 0) {
      return Array(points).fill(0);
    }
    
    // Generate cumulative word counts at different points in time
    const interval = sortedData.length / points;
    let cumulativeWordCount = 0;
    
    for (let i = 0; i < points; i++) {
      const index = Math.min(Math.floor(i * interval), sortedData.length - 1);
      // Add up all word counts up to this point
      cumulativeWordCount = sortedData.slice(0, index + 1)
        .reduce((sum, item) => sum + (item.wordCount || 0), 0);
      result.push(cumulativeWordCount);
    }
    
    return result;
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

  // Admin Authentication
  async verifyAdminCredentials(credentials: AdminLogin): Promise<boolean> {
    try {
      const result = await db.select().from(admin).where(
        and(
          eq(admin.username, credentials.username),
          eq(admin.password, credentials.password)
        )
      );
      
      return result.length > 0;
    } catch (error) {
      console.error("Error verifying admin credentials:", error);
      return false;
    }
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
      extractTopics: insertEpisode.extractTopics || false,
      extractKeywords: insertEpisode.extractKeywords || false
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
    try {
      console.time('getSystemStats');
      
      // Get total episodes count
      const totalEpisodesResult = await db.select({ count: sql<number>`COUNT(*)` }).from(episodes);
      const totalEpisodes = Number(totalEpisodesResult[0]?.count || 0);
      
      // Get processing queue count
      const queueCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(processingQueue)
        .where(eq(processingQueue.status, "queued"));
      const queueLength = Number(queueCountResult[0]?.count || 0);
      
      // Get counts by status
      const completedCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(eq(episodes.status, "completed"));
      const completedCount = Number(completedCountResult[0]?.count || 0);
      
      const failedCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(eq(episodes.status, "failed"));
      const failedCount = Number(failedCountResult[0]?.count || 0);
      
      // Calculate success rate
      const totalProcessed = completedCount + failedCount;
      const successRate = totalProcessed === 0 ? 100 : Math.round((completedCount / totalProcessed) * 100);
      
      // Get method distribution
      const captionCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(eq(episodes.extractionMethod, "caption"));
      const scrapingCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(eq(episodes.extractionMethod, "scraping"));
      const audioCountResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(eq(episodes.extractionMethod, "audio"));
      
      const methodDistribution = {
        caption: Number(captionCountResult[0]?.count || 0),
        scraping: Number(scrapingCountResult[0]?.count || 0),
        audio: Number(audioCountResult[0]?.count || 0)
      };
      
      // Calculate average processing time
      const processingTimesResult = await db.select({
        startTime: episodes.processingStarted,
        endTime: episodes.processingCompleted
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
      if (processingTimesResult.length > 0) {
        const processingTimes = processingTimesResult
          .map(result => {
            if (!result.startTime || !result.endTime) return 0;
            return (new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 60000;
          })
          .filter(time => time > 0);
        
        if (processingTimes.length > 0) {
          const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
          averageProcessingTime = `${avgTime.toFixed(1)}min`;
        }
      }
      
      // Calculate total word count with a single SQL query
      const wordCountResult = await db.select({
        totalWords: sql<number>`COALESCE(SUM(${episodes.wordCount}), 0)`
      })
      .from(episodes)
      .where(sql`${episodes.wordCount} IS NOT NULL`);
      
      let totalWordCount = Number(wordCountResult[0]?.totalWords || 0);
      
      // Find episodes with transcripts but no word count
      const missingWordCountEpisodes = await db.select({
        id: episodes.id,
        transcript: episodes.transcript
      })
      .from(episodes)
      .where(
        and(
          sql`${episodes.transcript} IS NOT NULL`,
          sql`${episodes.wordCount} IS NULL`
        )
      );
      
      // Update word counts for episodes missing them
      for (const episode of missingWordCountEpisodes) {
        if (!episode.transcript) continue;
        
        const wordCount = episode.transcript.split(/\s+/).length;
        totalWordCount += wordCount;
        
        // Update the episode with the calculated word count
        await db.update(episodes)
          .set({ wordCount })
          .where(eq(episodes.id, episode.id));
      }
      
      // Format total word count with comma separators
      const formattedWordCount = totalWordCount.toLocaleString();
      
      // Get daily processed episodes count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      
      const dailyProcessedResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(episodes)
        .where(
          and(
            eq(episodes.status, "completed"),
            sql`${episodes.createdAt} >= ${todayStr}`
          )
        );
      const dailyProcessed = Number(dailyProcessedResult[0]?.count || 0);
      
      // Simple trend calculation
      const episodesTrend = 5; // Placeholder value
      const wordCountTrend = 10; // Placeholder value
      
      console.timeEnd('getSystemStats');
      
      // Create mock history data
      const mockHistory = this.createMockHistoryData(totalEpisodes, totalWordCount);
      
      return {
        totalEpisodes,
        processingQueue: queueLength,
        successRate,
        averageProcessingTime,
        totalWordCount: formattedWordCount,
        dailyProcessed,
        methodDistribution,
        trends: {
          totalEpisodes: episodesTrend,
          successRate: 0,
          processingTime: 0,
          wordCount: wordCountTrend
        },
        history: mockHistory,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error getting system stats:", error);
      return this.getDefaultStats();
    }
  }
  
  // Helper method to create mock history data
  private createMockHistoryData(totalEpisodes: number, totalWordCount: number): SystemStats['history'] {
    const historySize = 20;
    const episodesHistory: number[] = [];
    const processingTimeHistory: number[] = [];
    const wordCountHistory: number[] = [];
    
    for (let i = 0; i < historySize; i++) {
      const ratio = (i + 1) / historySize;
      episodesHistory.push(Math.round(totalEpisodes * ratio));
      processingTimeHistory.push(i + 1);
      wordCountHistory.push(Math.round(totalWordCount * ratio));
    }
    
    return {
      totalEpisodes: episodesHistory,
      processingTime: processingTimeHistory,
      wordCount: wordCountHistory
    };
  }
  
  // Default stats when there's an error
  private getDefaultStats(): SystemStats {
    return {
      totalEpisodes: 0,
      processingQueue: 0,
      successRate: 100,
      averageProcessingTime: "0min",
      totalWordCount: "0",
      dailyProcessed: 0,
      methodDistribution: { caption: 0, scraping: 0, audio: 0 },
      trends: {
        totalEpisodes: 0,
        successRate: 0,
        processingTime: 0,
        wordCount: 0
      },
      history: {
        totalEpisodes: [],
        processingTime: [],
        wordCount: []
      },
      lastUpdated: new Date().toISOString()
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

  // Admin Authentication
  async verifyAdminCredentials(credentials: AdminLogin): Promise<boolean> {
    try {
      const result = await db.select().from(admin).where(
        and(
          eq(admin.username, credentials.username),
          eq(admin.password, credentials.password)
        )
      );
      
      return result.length > 0;
    } catch (error) {
      console.error("Error verifying admin credentials:", error);
      return false;
    }
  }
}

export const storage = new PostgresStorage();

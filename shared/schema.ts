import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // "admin", "user"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  channel: text("channel"),
  duration: text("duration"),
  thumbnailUrl: text("thumbnail_url"),
  youtubeUrl: text("youtube_url").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "failed"
  extractionMethod: text("extraction_method").notNull(), // "caption", "scraping", "audio"
  transcript: text("transcript"),
  summary: text("summary"),
  topics: jsonb("topics").default([]),
  wordCount: integer("word_count"),
  processingStarted: timestamp("processing_started"),
  processingCompleted: timestamp("processing_completed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
});

export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  userId: integer("user_id").references(() => users.id),
  resultCount: integer("result_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processingQueue = pgTable("processing_queue", {
  id: serial("id").primaryKey(),
  episodeId: integer("episode_id").references(() => episodes.id).notNull(),
  priority: integer("priority").default(0),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  status: text("status").notNull().default("queued"), // "queued", "processing", "completed", "failed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEpisodeSchema = createInsertSchema(episodes).omit({
  id: true,
  createdAt: true,
  processingStarted: true,
  processingCompleted: true,
}).extend({
  youtubeUrl: z.string().url(),
  extractionMethod: z.enum(["caption", "scraping", "audio"]),
  generateSummary: z.boolean().optional(),
  extractTopics: z.boolean().optional(),
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;

export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;

export type ProcessingQueueItem = typeof processingQueue.$inferSelect;

// API Response types
export type EpisodeWithProgress = Episode & {
  progress?: number;
  estimatedTime?: string;
};

export type SearchResult = {
  episode: Episode;
  highlights: Array<{
    segment: string;
    timestamp: string;
    matchScore: number;
  }>;
  totalMatches: number;
};

export type SystemStats = {
  totalEpisodes: number;
  processingQueue: number;
  successRate: number;
  averageProcessingTime: string;
  totalStorage: string;
  dailyProcessed: number;
  methodDistribution: {
    caption: number;
    scraping: number;
    audio: number;
  };
};

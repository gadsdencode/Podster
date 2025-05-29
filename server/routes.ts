import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import { insertEpisodeSchema, insertUserSchema, insertSearchQuerySchema } from "@shared/schema";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { TsCaptionScraper } from "./ts-caption-scraper";
import { TsAdvancedScraper } from "./ts-advanced-scraper";
import { KeywordAnalyzer } from "./keyword-analyzer";

dotenv.config();

// Initialize the caption scrapers
const captionScraper = new TsCaptionScraper();
const advancedScraper = new TsAdvancedScraper();
const keywordAnalyzer = new KeywordAnalyzer();

// Mock YouTube processing functions
const extractVideoInfo = async (url: string) => {
  const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
  if (!videoId) throw new Error("Invalid YouTube URL");
  
  try {
    // Use YouTube oEmbed API for real video data
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video information: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      videoId,
      title: data.title,
      description: null,
      channel: data.author_name,
      duration: null,
      thumbnailUrl: data.thumbnail_url
    };
  } catch (error: any) {
    console.error('Error fetching real video info:', error);
    throw new Error(`Cannot extract video information: ${error.message}`);
  }
};

const extractTranscript = async (videoId: string, method: string) => {
  try {
    console.log(`Extracting real transcript for video ${videoId} using ${method} method`);
    
    if (method === "youtube") {
      // Try YouTube API method first if selected
      // ... existing code ...
    }
    
    if (method === "scraping") {
      console.log("Using web scraping method for transcript extraction");
      
      // Try each extraction method in sequence, from simplest to most complex
      
      // 1. First try the basic TypeScript scraper
      try {
        console.log("Using basic TypeScript caption scraper");
        const result = await captionScraper.extractCaptions(videoId);
        
        if (result && result.transcript && result.transcript.length > 100) {
          console.log(`Successfully extracted ${result.transcript.length} characters with basic TypeScript scraper`);
          return result.transcript;
        } else {
          console.log("Basic TypeScript scraper failed or returned insufficient data, trying advanced methods");
        }
      } catch (error) {
        const scrapingError = error as Error;
        console.error(`Basic TypeScript scraper error: ${scrapingError.message}`);
        console.log("Trying advanced extraction methods");
      }
      
      // 2. Try the advanced TypeScript scraper with multiple extraction techniques
      try {
        console.log("Using advanced TypeScript caption scraper");
        const advancedResult = await advancedScraper.extractCaptions(videoId);
        
        if (advancedResult && advancedResult.transcript && advancedResult.transcript.length > 100) {
          console.log(`Successfully extracted ${advancedResult.transcript.length} characters with advanced TypeScript scraper`);
          return advancedResult.transcript;
        } else {
          console.log("Advanced TypeScript scraper failed or returned insufficient data, trying Puppeteer fallback");
        }
      } catch (error) {
        const advancedError = error as Error;
        console.error(`Advanced TypeScript scraper error: ${advancedError.message}`);
        console.log("Falling back to Puppeteer method");
      }
      
      // 3. As a last resort, try Puppeteer browser automation
      try {
        console.log("Attempting to extract transcript with Puppeteer");
        // Dynamic import of the Puppeteer module
        const puppeteerModule = await import('./puppeteer_caption_scraper.js');
        const puppeteerTranscript = await puppeteerModule.extractCaptionsWithPuppeteer(videoId);
        
        if (puppeteerTranscript && puppeteerTranscript.length > 100) {
          console.log(`Successfully extracted transcript with Puppeteer: ${puppeteerTranscript.length} chars`);
          return puppeteerTranscript;
        } else {
          throw new Error("Puppeteer extraction failed or returned insufficient data");
        }
      } catch (error) {
        const puppeteerError = error as Error;
        console.error(`Puppeteer extraction error: ${puppeteerError.message}`);
        throw new Error(`All web scraping methods failed: ${puppeteerError.message}`);
      }
    }
    
    if (method === "audio") {
      throw new Error("Audio extraction requires additional setup. Please try Caption-Based or Web Scraping methods first.");
    }
    
    throw new Error(`Unsupported extraction method: ${method}`);
    
  } catch (error: any) {
    console.error(`Transcript extraction failed: ${error.message}`);
    throw new Error(`Cannot extract real transcript: ${error.message}`);
  }
};

const generateSummary = async (transcript: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating concise, informative summaries of video transcripts. Create a 2-3 sentence summary that captures the main points and key insights.'
          },
          {
            role: 'user',
            content: `Please summarize this video transcript:\n\n${transcript}`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Summary could not be generated.";
  } catch (error) {
    console.error('Error generating summary:', error);
    return "AI summary generation temporarily unavailable.";
  }
};

// New function to enhance transcript readability with improved efficiency
const enhanceTranscriptReadability = async (transcript: string): Promise<string> => {
  try {
    // Skip processing if transcript is too short
    if (!transcript || transcript.length < 50) {
      console.log('Transcript too short, skipping enhancement');
      return transcript;
    }

    console.log(`Enhancing transcript readability (length: ${transcript.length} chars)...`);
    
    // For large transcripts, process in chunks
    if (transcript.length > 4000) {
      console.log(`Large transcript detected (${transcript.length} chars), using chunk processing`);
      return processTranscriptInChunks(transcript);
    }
    
    // For smaller transcripts, process directly
    console.log('Processing transcript in single request');
    return await enhanceChunkWithAI(transcript);
  } catch (error) {
    console.error('Error in enhanceTranscriptReadability:', error);
    // Return original transcript if enhancement fails
    return transcript;
  }
};

// Optimized chunking with better token management and no recursion
async function processTranscriptInChunks(transcript: string): Promise<string> {
  try {
    console.log('Starting chunk-based transcript processing...');
    
    // Calculate approximate tokens (rough estimate: 4 chars per token)
    const estimatedTokens = Math.ceil(transcript.length / 4);
    console.log(`Estimated total tokens: ${estimatedTokens}`);
    
    // Define max tokens per chunk (stay well under the 4k token limit)
    const MAX_TOKENS_PER_CHUNK = 3000;
    
    // Split into paragraphs first
    const paragraphs = transcript.split(/\n\n+/);
    console.log(`Split transcript into ${paragraphs.length} paragraphs`);
    
    // Initialize chunks array
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokenCount = 0;
    
    // Build chunks based on token count
    for (const paragraph of paragraphs) {
      const paragraphTokens = Math.ceil(paragraph.length / 4);
      
      // If adding this paragraph would exceed our chunk size, start a new chunk
      if (currentTokenCount + paragraphTokens > MAX_TOKENS_PER_CHUNK && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
        currentTokenCount = paragraphTokens;
      } else {
        // Otherwise add to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokenCount += paragraphTokens;
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    console.log(`Created ${chunks.length} chunks for processing`);
    
    // Process chunks with controlled concurrency
    const enhancedChunks: string[] = [];
    const BATCH_SIZE = 2; // Process 2 chunks at a time to avoid rate limits
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`);
      
      // Create a batch of promises
      const batchPromises = chunks
        .slice(i, i + BATCH_SIZE)
        .map((chunk, index) => {
          console.log(`Processing chunk ${i + index + 1}/${chunks.length} (${chunk.length} chars)...`);
          return enhanceChunkWithAI(chunk as string)
            .then(enhancedChunk => {
              console.log(`Chunk ${i + index + 1} processed successfully`);
              return enhancedChunk;
            })
            .catch(error => {
              console.error(`Error processing chunk ${i + index + 1}:`, error);
              // Return original chunk on error
              return chunk as string;
            });
        });
      
      // Wait for all chunks in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      enhancedChunks.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < chunks.length) {
        console.log('Waiting between batches to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Join enhanced chunks with paragraph breaks
    const result = enhancedChunks.join('\n\n');
    console.log(`Successfully enhanced transcript in chunks. Final length: ${result.length} chars`);
    return result;
  } catch (error) {
    console.error('Error in chunk processing:', error);
    // Return original if batch processing fails
    return transcript;
  }
}

// Direct AI enhancement for a single chunk, no recursion
async function enhanceChunkWithAI(chunk: string): Promise<string> {
  try {
    // Skip tiny chunks
    if (!chunk || chunk.length < 50) {
      return chunk;
    }
    
    // Calculate approximate tokens for logging
    const estimatedTokens = Math.ceil(chunk.length / 4);
    console.log(`Enhancing chunk with ~${estimatedTokens} tokens`);
    
    // Add retry mechanism
    let retries = 0;
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    // Fallback options for models
    const models = [
      'gpt-3.5-turbo-16k',  // Try 16k model first
      'gpt-3.5-turbo',      // Fallback to standard model
      'gpt-4'               // Last resort (if configured)
    ];
    
    // Try each model in sequence if needed
    for (const model of models) {
      // Skip gpt-4 if not explicitly configured
      if (model.includes('gpt-4') && !process.env.USE_GPT4_FALLBACK) {
        continue;
      }
      
      // Reset retries for each model
      retries = 0;
      
      while (retries < MAX_RETRIES) {
        try {
          console.log(`Attempting to enhance chunk with model: ${model}, attempt ${retries + 1}/${MAX_RETRIES}`);
          
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: `You are an expert at improving the readability of automatically generated transcripts.
Your task is to enhance readability by:
1. Fixing capitalization and punctuation
2. Removing filler words and redundancies
3. Correcting obvious grammar mistakes
4. Maintaining timestamps in [MM:SS] format at paragraph starts
5. Creating well-structured paragraphs
6. Preserving the original meaning and all important information

IMPORTANT: 
- Keep all original timestamps in [MM:SS] format
- Maintain paragraph breaks (denoted by double newlines)
- Don't change the factual content
- Don't add information that isn't present
- Preserve any speaker indicators`
                },
                {
                  role: 'user',
                  content: `Please enhance the readability of this transcript while keeping all timestamps and paragraph breaks:\n\n${chunk}`
                }
              ],
              max_tokens: model.includes('16k') ? 4000 : 2000, // Adjust based on model
              temperature: 0.3,
            }),
          });

          // Handle various error responses
          if (!response.ok) {
            const status = response.status;
            
            // Get detailed error information
            let errorDetail = '';
            try {
              const errorData = await response.json();
              errorDetail = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
              errorDetail = await response.text() || `Status ${status}`;
            }
            
            // Handle specific error codes
            if (status === 429) {
              throw new Error(`Rate limit exceeded: ${errorDetail}`);
            } else if (status === 400 && errorDetail.includes('tokens')) {
              throw new Error(`Token limit exceeded: ${errorDetail}`);
            } else if (status >= 500) {
              throw new Error(`OpenAI server error: ${errorDetail}`);
            } else {
              throw new Error(`OpenAI API error (${status}): ${errorDetail}`);
            }
          }

          const data = await response.json();
          const enhancedChunk = data.choices[0]?.message?.content;
          
          if (!enhancedChunk) {
            throw new Error('No response content from OpenAI');
          }
          
          console.log(`Successfully enhanced chunk with model: ${model}`);
          return enhancedChunk;
        } catch (error) {
          lastError = error as Error;
          retries++;
          
          const errorMessage = (error as Error).message || 'Unknown error';
          console.log(`Attempt ${retries}/${MAX_RETRIES} with model ${model} failed: ${errorMessage}`);
          
          // Determine if we should retry or try next model
          if (
            errorMessage.includes('rate limit') || 
            errorMessage.includes('server error') || 
            errorMessage.includes('timeout')
          ) {
            // These errors warrant a retry with exponential backoff
            const delay = retries * 2000;
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (errorMessage.includes('token limit')) {
            // For token limit issues, break and try next model
            console.log(`Token limit issue with ${model}, trying next model...`);
            break;
          } else {
            // For other errors, retry with shorter delay
            const delay = retries * 1000;
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we made it here and have exceeded retries, try next model
      console.log(`All attempts with model ${model} failed, trying next model...`);
    }
    
    // If we got here, all models and retries failed
    console.error('All enhancement attempts failed after trying multiple models:', lastError);
    
    // Simple fallback: basic cleanup without AI
    console.log('Performing basic cleanup as fallback');
    return performBasicCleanup(chunk);
  } catch (error) {
    console.error('Error in AI enhancement:', error);
    // Return original chunk if enhancement fails
    return chunk;
  }
}

// Basic cleanup function as fallback for when AI enhancement fails
function performBasicCleanup(text: string): string {
  try {
    // Implement some basic cleanup rules
    return text
      // Fix capitalization after periods
      .replace(/\. [a-z]/g, match => match.toUpperCase())
      // Remove filler words
      .replace(/(\s|^)(um|uh|like,|you know,|i mean,|basically,|actually,|so,)(\s|$)/gi, ' ')
      // Fix double spaces
      .replace(/\s{2,}/g, ' ')
      // Fix spacing after punctuation
      .replace(/([.!?])\s*([a-zA-Z])/g, '$1 $2')
      // Preserve timestamp format [MM:SS]
      .replace(/\[(\d+:\d+)\]/g, match => match.toUpperCase())
      // Trim whitespace
      .trim();
  } catch (e) {
    console.error('Error in basic cleanup:', e);
    return text;
  }
}

const extractTopics = async (transcript: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at identifying key topics and themes from video transcripts. Extract 3-6 main topics as single words or short phrases. Return only the topics separated by commas.'
          },
          {
            role: 'user',
            content: `Extract the main topics from this video transcript:\n\n${transcript}`
          }
        ],
        max_tokens: 100,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const topicsString = data.choices[0]?.message?.content || "";
    return topicsString.split(',').map((topic: string) => topic.trim()).filter((topic: string) => topic.length > 0);
  } catch (error) {
    console.error('Error extracting topics:', error);
    return ["AI topic extraction temporarily unavailable"];
  }
};

// Function to process episodes automatically with progress tracking
const processEpisode = async (episodeId: number, options: { generateSummary?: boolean; extractTopics?: boolean }) => {
  try {
    const episode = await storage.getEpisode(episodeId);
    if (!episode) {
      console.error(`Episode ${episodeId} not found`);
      return;
    }

    console.log(`Starting processing for episode ${episodeId} with method: ${episode.extractionMethod}`);
    
    // Step 1: Initialize processing (10%)
    await storage.updateEpisode(episodeId, { 
      status: "processing",
      progress: 10,
      currentStep: "Initializing extraction",
      processingStarted: new Date()
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 2: Extract transcript (60%)
    await storage.updateEpisode(episodeId, { 
      progress: 30,
      currentStep: "Extracting transcript"
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const transcript = await extractTranscript(episode.videoId, episode.extractionMethod);
    const wordCount = transcript.split(/\s+/).length;
    
    await storage.updateEpisode(episodeId, { 
      progress: 60,
      currentStep: "Transcript extracted successfully"
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let summary = null;
    let topics: string[] = [];
    
    // Step 3: Generate AI content if requested
    if (options.generateSummary) {
      await storage.updateEpisode(episodeId, { 
        progress: 70,
        currentStep: "Generating AI summary"
      });
      console.log(`Generating AI summary for episode ${episodeId}`);
      summary = await generateSummary(transcript);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (options.extractTopics) {
      await storage.updateEpisode(episodeId, { 
        progress: 85,
        currentStep: "Extracting key topics"
      });
      console.log(`Extracting AI topics for episode ${episodeId}`);
      topics = await extractTopics(transcript);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Step 4: Finalize (100%)
    await storage.updateEpisode(episodeId, { 
      progress: 95,
      currentStep: "Finalizing processing"
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Complete processing
    await storage.updateEpisode(episodeId, {
      status: "completed",
      transcript,
      summary,
      topics,
      wordCount,
      progress: 100,
      currentStep: "Processing completed",
      processingCompleted: new Date()
    });

    console.log(`Processing completed for episode ${episodeId}`);
  } catch (error: any) {
    console.error(`Processing failed for episode ${episodeId}:`, error);
    await storage.updateEpisode(episodeId, {
      status: "failed",
      errorMessage: error.message,
      progress: 0,
      currentStep: "Processing failed",
      processingCompleted: new Date()
    });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Admin Authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const isValid = await storage.verifyAdminCredentials({ username, password });
      
      if (isValid) {
        // Set admin session cookie
        req.session.isAdmin = true;
        return res.status(200).json({ success: true });
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error: any) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/admin/logout", (req, res) => {
    // Clear admin session
    req.session.isAdmin = false;
    res.status(200).json({ success: true });
  });
  
  app.get("/api/admin/check-auth", (req, res) => {
    if (req.session.isAdmin) {
      return res.status(200).json({ isAuthenticated: true });
    } else {
      return res.status(401).json({ isAuthenticated: false });
    }
  });
  
  // Middleware to check admin authentication
  const requireAdminAuth = (req: any, res: any, next: any) => {
    if (req.session.isAdmin) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  };

  // Protected admin routes
  app.get("/api/admin/users", requireAdminAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users", requireAdminAuth, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Episode management endpoints
  app.post("/api/episodes", async (req, res) => {
    try {
      const validatedData = insertEpisodeSchema.parse(req.body);
      
      // Extract video info from YouTube URL
      const videoInfo = await extractVideoInfo(validatedData.youtubeUrl);
      
      // Check if episode already exists
      const existingEpisode = await storage.getEpisodeByVideoId(videoInfo.videoId);
      if (existingEpisode) {
        return res.status(409).json({ 
          message: "Episode already exists",
          episode: existingEpisode 
        });
      }
      
      // Create episode with video info
      const episodeData = {
        youtubeUrl: validatedData.youtubeUrl,
        extractionMethod: validatedData.extractionMethod,
        generateSummary: validatedData.generateSummary,
        extractTopics: validatedData.extractTopics,
        userId: validatedData.userId || 1
      };
      
      const episode = await storage.createEpisode(episodeData);
      
      // Update with extracted video info
      const updatedEpisode = await storage.updateEpisode(episode.id, videoInfo);
      
      // Add to processing queue
      await storage.addToQueue(episode.id);
      
      // Start processing immediately
      setTimeout(async () => {
        try {
          await processEpisode(episode.id, {
            generateSummary: validatedData.generateSummary,
            extractTopics: validatedData.extractTopics
          });
        } catch (error) {
          console.error('Error starting episode processing:', error);
        }
      }, 1000); // Small delay to allow response to be sent
      
      res.status(201).json(updatedEpisode || episode);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/batch-process", async (req, res) => {
    try {
      const { urls, extractionMethod } = req.body;
      const results: Array<{success: boolean; episode?: any; message?: string; url?: string}> = [];
      
      for (const url of urls) {
        try {
          const videoInfo = await extractVideoInfo(url);
          const existingEpisode = await storage.getEpisodeByVideoId(videoInfo.videoId);
          
          if (!existingEpisode) {
            const episode = await storage.createEpisode({
              youtubeUrl: url,
              extractionMethod,
              ...videoInfo,
              userId: 1
            });
            await storage.addToQueue(episode.id);
            results.push({ success: true, episode });
          } else {
            results.push({ success: false, message: "Episode already exists", url });
          }
        } catch (error: any) {
          results.push({ success: false, message: error.message, url });
        }
      }
      
      res.json({ results });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/episodes/video/:videoId", async (req, res) => {
    try {
      const episode = await storage.getEpisodeByVideoId(req.params.videoId);
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      res.json(episode);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/episodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const episode = await storage.getEpisode(id);
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      res.json(episode);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/episodes", async (req, res) => {
    try {
      const episodes = await storage.getAllEpisodes();
      res.json(episodes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/episodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if episode exists first
      const episode = await storage.getEpisode(id);
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      const success = await storage.deleteEpisode(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete episode" });
      }
      
      res.json({ message: "Episode deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting episode:", error);
      res.status(500).json({ 
        message: "Error deleting episode", 
        error: error.message || "Unknown error"
      });
    }
  });

  // Processing endpoint
  app.post("/api/process/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const episode = await storage.getEpisode(id);
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      // Update status to processing
      await storage.updateEpisode(id, { 
        status: "processing",
        processingStarted: new Date(),
        progress: 10, // Start with 10% progress
        currentStep: "Starting transcript extraction..."
      });
      
      // Process the episode asynchronously
      setTimeout(async () => {
        try {
          // Update progress to show activity
          await storage.updateEpisode(id, {
            progress: 30,
            currentStep: "Extracting transcript..."
          });
          
          // Wait a moment to simulate processing
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const transcript = await extractTranscript(episode.videoId, episode.extractionMethod);
          const wordCount = transcript.split(/\s+/).length;
          
          // Update progress
          await storage.updateEpisode(id, {
            progress: 60,
            currentStep: "Processing extracted content..."
          });
          
          let summary = null;
          let topics: string[] = [];
          
          // Generate summary and topics if requested
          if (req.body.generateSummary) {
            summary = await generateSummary(transcript);
          }
          if (req.body.extractTopics) {
            topics = await extractTopics(transcript);
          }
          
          // Update progress
          await storage.updateEpisode(id, {
            progress: 90,
            currentStep: "Finalizing..."
          });
          
          // Wait a moment before final update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Final update with completed status
          await storage.updateEpisode(id, {
            status: "completed",
            transcript,
            summary,
            topics,
            wordCount,
            progress: 100,
            currentStep: "Completed successfully",
            processingCompleted: new Date()
          });
          
          console.log(`Episode ${id} processed successfully`);
        } catch (error: any) {
          console.error(`Error processing episode ${id}:`, error);
          await storage.updateEpisode(id, {
            status: "failed",
            errorMessage: error.message,
            progress: 100,
            currentStep: "Processing failed: " + error.message,
            processingCompleted: new Date()
          });
        }
      }, 1000); // Reduced from 3000 to 1000 for faster feedback
      
      res.json({ message: "Processing started", status: "processing" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Keyword analysis endpoint
  app.post("/api/analyze-keywords", async (req, res) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      // Use the KeywordAnalyzer service
      const analysisResult = await keywordAnalyzer.analyzeText(transcript);
      
      res.json(analysisResult);
    } catch (error: any) {
      console.error("Error analyzing keywords:", error);
      res.status(500).json({ error: error.message || "Failed to analyze keywords" });
    }
  });

  // Search endpoints
  app.post("/api/search", async (req, res) => {
    try {
      const { query, userId } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const results = await storage.searchTranscripts(query, userId);
      
      // Save search query
      await storage.createSearchQuery({
        query,
        userId: userId || null,
        resultCount: results.length
      });
      
      res.json({ results, totalResults: results.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transcript management
  app.put("/api/episodes/:id/transcript", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { transcript } = req.body;
      
      const episode = await storage.updateEpisode(id, {
        transcript,
        wordCount: transcript.split(/\s+/).length
      });
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      res.json(episode);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enrichment endpoint
  app.post("/api/enrich", async (req, res) => {
    try {
      const { episodeId, generateSummary: genSummary, extractTopics: extTopics } = req.body;
      const episode = await storage.getEpisode(episodeId);
      
      if (!episode || !episode.transcript) {
        return res.status(404).json({ message: "Episode or transcript not found" });
      }
      
      const updates: any = {};
      
      if (genSummary) {
        updates.summary = await generateSummary(episode.transcript);
      }
      
      if (extTopics) {
        updates.topics = await extractTopics(episode.transcript);
      }
      
      const updatedEpisode = await storage.updateEpisode(episodeId, updates);
      res.json(updatedEpisode);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics endpoints
  app.get("/api/stats", async (req, res) => {
    try {
      console.log("Stats API endpoint called");
      const stats = await storage.getSystemStats();
      console.log("Stats returned from storage:", JSON.stringify(stats, null, 2));
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Export endpoints
  app.get("/api/export/:format", async (req, res) => {
    try {
      const { format } = req.params;
      const episodes = await storage.getAllEpisodes();
      
      if (format === "json") {
        res.setHeader("Content-Disposition", "attachment; filename=episodes.json");
        res.setHeader("Content-Type", "application/json");
        res.json(episodes);
      } else if (format === "csv") {
        res.setHeader("Content-Disposition", "attachment; filename=episodes.csv");
        res.setHeader("Content-Type", "text/csv");
        
        const csvHeaders = "ID,Title,Channel,Duration,Status,Method,Word Count,Created At\n";
        const csvRows = episodes.map(ep => 
          `${ep.id},"${ep.title}","${ep.channel}","${ep.duration}","${ep.status}","${ep.extractionMethod}",${ep.wordCount || 0},"${ep.createdAt}"`
        ).join("\n");
        
        res.send(csvHeaders + csvRows);
      } else {
        res.status(400).json({ message: "Unsupported export format" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User management endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // In real app, verify password hash
      if (password === "admin123") { // Simple check for demo
        const { password: _, ...userWithoutPassword } = user;
        res.json({ 
          user: userWithoutPassword,
          token: "mock-jwt-token" // In real app, generate actual JWT
        });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/change_password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // In real app, verify current password and hash new password
      await storage.updateUser(userId, { password: newPassword });
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Queue management
  app.get("/api/queue", async (req, res) => {
    try {
      const queueItems = await storage.getQueueItems();
      res.json(queueItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // WebSocket for real-time updates would be implemented here
  // For now, we'll use polling endpoints

  app.get("/api/processing-status/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const episode = await storage.getEpisode(id);
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      // Use the actual progress and step data from the episode
      let progress = episode.progress || 0;
      let estimatedTime = "";
      let currentStep = episode.currentStep || "Preparing to process...";
      
      if (episode.status === "processing") {
        const startTime = episode.processingStarted?.getTime() || Date.now();
        const elapsed = Date.now() - startTime;
        const estimatedTotal = episode.extractionMethod === "audio" ? 300000 : 60000; // 5min for audio, 1min for others
        
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMinutes = Math.floor(remaining / 60000);
        const remainingSeconds = Math.floor((remaining % 60000) / 1000);
        estimatedTime = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      } else if (episode.status === "completed") {
        progress = 100;
        estimatedTime = "0:00";
        currentStep = "Processing completed";
      } else if (episode.status === "failed") {
        currentStep = "Processing failed";
      }
      
      res.json({
        ...episode,
        progress,
        estimatedTime,
        currentStep
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Enhanced transcript API
  app.post("/api/enhance-transcript", async (req, res) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ message: "Transcript is required" });
      }
      
      const enhancedTranscript = await enhanceTranscriptReadability(transcript);
      
      res.status(200).json({ 
        success: true,
        original: transcript,
        enhanced: enhancedTranscript
      });
    } catch (error: any) {
      console.error('Error in enhance-transcript endpoint:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        original: req.body.transcript
      });
    }
  });
  
  // Update episode endpoint with enhancement option
  app.post("/api/episodes/:id/enhance", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const episodeId = parseInt(id);
      
      if (isNaN(episodeId)) {
        return res.status(400).json({ message: "Invalid episode ID" });
      }
      
      const episode = await storage.getEpisode(episodeId);
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      if (!episode.transcript) {
        return res.status(400).json({ message: "Episode has no transcript to enhance" });
      }
      
      // Update the episode status to processing
      await storage.updateEpisode(episodeId, {
        status: "processing",
        progress: 5,
        currentStep: "Preparing transcript enhancement"
      });
      
      // Return immediate response to client
      res.status(202).json({ 
        success: true,
        message: "Transcript enhancement started",
        episodeId
      });
      
      // Process the enhancement in the background
      (async () => {
        try {
          // Extract word count for progress calculation
          const transcript = episode.transcript || '';
          const wordCount = transcript.split(/\s+/).length;
          const paragraphCount = transcript.split(/\n\n+/).length;
          
          // Update with more accurate progress information
          await storage.updateEpisode(episodeId, {
            progress: 10,
            currentStep: `Analyzing transcript (${wordCount.toLocaleString()} words in ${paragraphCount} paragraphs)`
          });
          
          // Analyze transcript size to provide better progress estimates
          if (transcript.length > 20000) {
            await storage.updateEpisode(episodeId, {
              progress: 15,
              currentStep: "Large transcript detected, preparing chunked processing"
            });
          }
          
          // Register progress update callback
          const updateProgress = async (percent: number, message: string) => {
            console.log(`Progress update for episode ${episodeId}: ${percent}% - ${message}`);
            await storage.updateEpisode(episodeId, {
              progress: Math.min(Math.max(Math.round(percent), 10), 95), // Clamp between 10-95%
              currentStep: message
            });
          };
          
          // Cache check - verify if we already started enhancing but didn't complete
          if (episode.enhancedTranscript && episode.enhancedTranscript.length > 100) {
            console.log(`Using cached partial enhancement for episode ${episodeId}`);
            await updateProgress(30, "Resuming from previously cached enhancement");
          } else {
            await updateProgress(20, "Starting enhancement process");
          }
          
          // Custom version of transcript chunking that reports progress
          let enhancedTranscript: string;
          
          if (transcript.length > 4000) {
            // For longer transcripts, we need a custom approach that reports progress
            const chunks: string[] = [];
            const paragraphs = transcript.split(/\n\n+/);
            console.log(`Processing ${paragraphs.length} paragraphs in chunks`);
            
            // Build chunks based on token count (approx 4 chars per token)
            const MAX_TOKENS_PER_CHUNK = 3000;
            let currentChunk = '';
            let currentTokenCount = 0;
            
            for (const paragraph of paragraphs) {
              const paragraphTokens = Math.ceil(paragraph.length / 4);
              
              if (currentTokenCount + paragraphTokens > MAX_TOKENS_PER_CHUNK && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = paragraph;
                currentTokenCount = paragraphTokens;
              } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                currentTokenCount += paragraphTokens;
              }
            }
            
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            
            console.log(`Split transcript into ${chunks.length} chunks for processing`);
            await updateProgress(25, `Preparing to process transcript in ${chunks.length} chunks`);
            
            // Process chunks with progress updates
            const enhancedChunks: string[] = [];
            const BATCH_SIZE = 2; // Process 2 chunks at a time
            
            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
              const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
              const progressPercent = 25 + (70 * (i / chunks.length));
              
              await updateProgress(
                progressPercent, 
                `Processing batch ${batchNumber}/${totalBatches} (${Math.round(progressPercent)}%)`
              );
              
              // Process current batch
              const batchPromises = chunks
                .slice(i, i + BATCH_SIZE)
                .map((chunk, index) => {
                  return enhanceChunkWithAI(chunk as string)
                    .catch(error => {
                      console.error(`Error processing chunk ${i + index + 1}:`, error);
                      return chunk as string; // Return original on error
                    });
                });
              
              const batchResults = await Promise.all(batchPromises);
              enhancedChunks.push(...batchResults);
              
              // Update progress after each batch
              const newProgressPercent = 25 + (70 * ((i + BATCH_SIZE) / chunks.length));
              await updateProgress(
                newProgressPercent,
                `Completed batch ${batchNumber}/${totalBatches} (${Math.round(newProgressPercent)}%)`
              );
              
              // Small delay between batches
              if (i + BATCH_SIZE < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            // Join enhanced chunks
            enhancedTranscript = enhancedChunks.join('\n\n');
          } else {
            // For shorter transcripts, use the standard approach
            await updateProgress(30, "Processing transcript");
            enhancedTranscript = await enhanceTranscriptReadability(transcript);
            await updateProgress(80, "Enhancement completed, finalizing");
          }
          
          // Update progress to 90%
          await updateProgress(90, "Enhancement complete, saving results");
          
          // Small delay to ensure database write completes
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Update the episode with the enhanced transcript
          await storage.updateEpisode(episodeId, {
            enhancedTranscript,
            status: "completed",
            progress: 100,
            currentStep: "Transcript enhancement completed successfully",
            hasEnhancedTranscript: true
          });
          
          console.log(`Successfully enhanced transcript for episode ${episodeId}`);
        } catch (error: any) {
          console.error(`Error enhancing transcript for episode ${episodeId}:`, error);
          
          // Update episode with error status
          await storage.updateEpisode(episodeId, {
            status: "failed",
            progress: 0,
            currentStep: `Enhancement failed: ${error.message}`,
          });
        }
      })();
      
    } catch (error: any) {
      console.error('Error handling enhance request:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message
      });
    }
  });

  // New endpoint to check enhancement status more efficiently
  app.get("/api/episodes/:id/enhancement-status", async (req, res) => {
    try {
      const { id } = req.params;
      const episodeId = parseInt(id);
      
      if (isNaN(episodeId)) {
        return res.status(400).json({ message: "Invalid episode ID" });
      }
      
      // Only fetch the necessary fields
      const episode = await storage.getEpisode(episodeId);
      
      if (!episode) {
        return res.status(404).json({ message: "Episode not found" });
      }
      
      // Return minimal status information
      res.json({
        episodeId,
        status: episode.status,
        progress: episode.progress || 0,
        currentStep: episode.currentStep,
        hasEnhancedTranscript: episode.hasEnhancedTranscript || false,
        isProcessing: episode.status === "processing",
        isCompleted: episode.status === "completed" && episode.hasEnhancedTranscript,
        isFailed: episode.status === "failed"
      });
    } catch (error: any) {
      console.error('Error checking enhancement status:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

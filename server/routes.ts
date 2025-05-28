import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEpisodeSchema, insertUserSchema, insertSearchQuerySchema } from "@shared/schema";
import { z } from "zod";

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
  console.log(`Extracting real transcript for video ${videoId} using ${method} method`);
  
  try {
    if (method === "caption") {
      // Caption-based method: Use YouTube Transcript API
      const { spawn } = require('child_process');
      
      return new Promise<string>((resolve, reject) => {
        const pythonCode = `
import os
import sys
os.chdir('.pythonlibs')

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    transcript_list = YouTubeTranscriptApi.get_transcript('${videoId}', languages=['en', 'en-US', 'en-GB'])
    full_transcript = ""
    for segment in transcript_list:
        full_transcript += segment['text'] + " "
    result = full_transcript.strip()
    if len(result) > 0:
        print(result)
    else:
        print("ERROR: Empty transcript", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        const python = spawn('python3', ['-c', pythonCode]);
        let output = '';
        let error = '';

        python.stdout.on('data', (data: any) => {
          output += data.toString();
        });

        python.stderr.on('data', (data: any) => {
          error += data.toString();
        });

        python.on('close', (code: any) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            reject(new Error(error || 'Caption extraction failed'));
          }
        });
      });
    }
    
    if (method === "scraping") {
      // Web scraping method: Use caption scraper as primary method
      const { spawn } = require('child_process');
      
      return new Promise<string>((resolve, reject) => {
        const pythonCode = `
import os
import sys
sys.path.append('server')

try:
    from caption_scraper import CaptionScraper
    
    scraper = CaptionScraper()
    result = scraper.extract_captions_from_page('${videoId}')
    
    if result and result.get('transcript'):
        transcript = result['transcript']
        if len(transcript.strip()) > 50:
            print(transcript)
        else:
            print("ERROR: Transcript too short", file=sys.stderr)
            sys.exit(1)
    else:
        print("ERROR: No transcript found via web scraping", file=sys.stderr)
        sys.exit(1)
        
except Exception as e:
    print(f"ERROR: Web scraping failed - {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        const python = spawn('python3', ['-c', pythonCode]);

        let output = '';
        let error = '';

        python.stdout.on('data', (data: any) => {
          output += data.toString();
        });

        python.stderr.on('data', (data: any) => {
          error += data.toString();
        });

        python.on('close', (code: any) => {
          if (code === 0 && output.trim()) {
            const transcript = output.trim();
            console.log(`Successfully extracted ${transcript.length} characters via web scraping`);
            resolve(transcript);
          } else {
            const errorMsg = error.includes('ERROR:') ? error.replace('ERROR:', '').trim() : 'Web scraping failed';
            console.error(`Web scraping failed: ${errorMsg}`);
            reject(new Error(`Web scraping extraction failed: ${errorMsg}`));
          }
        });
      });
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
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Extract transcript (60%)
    await storage.updateEpisode(episodeId, { 
      progress: 30,
      currentStep: "Extracting transcript"
    });
    
    const transcript = await extractTranscript(episode.videoId, episode.extractionMethod);
    const wordCount = transcript.split(/\s+/).length;
    
    await storage.updateEpisode(episodeId, { 
      progress: 60,
      currentStep: "Transcript extracted successfully"
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
      const results = [];
      
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

  app.get("/api/episodes", async (req, res) => {
    try {
      const episodes = await storage.getAllEpisodes();
      res.json(episodes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/episodes/:videoId", async (req, res) => {
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

  app.delete("/api/episodes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEpisode(id);
      if (!success) {
        return res.status(404).json({ message: "Episode not found" });
      }
      res.json({ message: "Episode deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
        processingStarted: new Date()
      });
      
      // Simulate processing (in real app, this would be async)
      setTimeout(async () => {
        try {
          const transcript = await extractTranscript(episode.videoId, episode.extractionMethod);
          const wordCount = transcript.split(/\s+/).length;
          
          let summary = null;
          let topics: string[] = [];
          
          // Generate summary and topics if requested
          if (req.body.generateSummary) {
            summary = await generateSummary(transcript);
          }
          if (req.body.extractTopics) {
            topics = await extractTopics(transcript);
          }
          
          await storage.updateEpisode(id, {
            status: "completed",
            transcript,
            summary,
            topics,
            wordCount,
            processingCompleted: new Date()
          });
        } catch (error: any) {
          await storage.updateEpisode(id, {
            status: "failed",
            errorMessage: error.message,
            processingCompleted: new Date()
          });
        }
      }, 3000);
      
      res.json({ message: "Processing started" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error: any) {
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

  app.post("/api/admin/users", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
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
      
      let progress = 0;
      let estimatedTime = "";
      
      if (episode.status === "processing") {
        // Simulate progress calculation
        const startTime = episode.processingStarted?.getTime() || Date.now();
        const elapsed = Date.now() - startTime;
        const estimatedTotal = episode.extractionMethod === "audio" ? 300000 : 120000; // 5min for audio, 2min for others
        progress = Math.min(Math.round((elapsed / estimatedTotal) * 100), 95);
        
        const remaining = Math.max(0, estimatedTotal - elapsed);
        const remainingMinutes = Math.floor(remaining / 60000);
        const remainingSeconds = Math.floor((remaining % 60000) / 1000);
        estimatedTime = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      } else if (episode.status === "completed") {
        progress = 100;
        estimatedTime = "0:00";
      }
      
      res.json({
        ...episode,
        progress,
        estimatedTime
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import axios from 'axios';
import * as cheerio from 'cheerio';

interface CaptionTrack {
  languageCode: string;
  name?: string;
  kind?: string;
  baseUrl?: string;
}

export interface CaptionResult {
  transcript: string;
  title: string;
  date: string;
  channel: string;
  videoId: string;
  extractionMethod: string;
}

export class TsCaptionScraper {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  
  async extractCaptions(videoId: string): Promise<CaptionResult | null> {
    try {
      console.log(`Starting TS caption extraction for video: ${videoId}`);
      
      // Try direct caption extraction
      const captionText = await this.extractDirectCaptions(videoId);
      
      if (!captionText || captionText.length < 50) {
        console.log('Direct caption extraction failed, trying page scraping');
        return null;
      }
      
      // Get basic metadata
      const { title, date, channel } = await this.getBasicMetadata(videoId);
      
      return {
        transcript: captionText,
        title: title || `Video ${videoId}`,
        date: date || new Date().toISOString().split('T')[0],
        channel: channel || 'Unknown Channel',
        videoId,
        extractionMethod: 'web_scraping'
      };
    } catch (error) {
      console.error(`Error extracting captions: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  private async extractDirectCaptions(videoId: string): Promise<string | null> {
    try {
      // Get the video page to extract caption data
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`Fetching video page: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/'
        },
        timeout: 15000
      });
      
      if (response.status !== 200) {
        console.error(`Failed to fetch video page: ${response.status}`);
        return null;
      }
      
      const html = response.data;
      
      // Extract player configuration
      const playerConfigMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      
      if (!playerConfigMatch) {
        console.error('Could not find player configuration');
        return null;
      }
      
      const playerConfig = JSON.parse(playerConfigMatch[1]);
      
      // Extract caption tracks
      const captions = playerConfig.captions;
      if (!captions) {
        console.error('No captions data found in player config');
        return null;
      }
      
      const captionTracks: CaptionTrack[] = captions.playerCaptionsTracklistRenderer?.captionTracks || [];
      
      if (captionTracks.length === 0) {
        console.error('No caption tracks found');
        return null;
      }
      
      console.log(`Found ${captionTracks.length} caption tracks`);
      
      // Find English caption track
      let englishTrack = captionTracks.find(track => 
        track.languageCode && track.languageCode.startsWith('en') && track.kind !== 'asr'
      );
      
      // Fall back to auto-generated if no manual English track
      if (!englishTrack) {
        englishTrack = captionTracks.find(track => 
          track.languageCode && track.languageCode.startsWith('en')
        );
      }
      
      // Fall back to any track if no English track
      if (!englishTrack && captionTracks.length > 0) {
        englishTrack = captionTracks[0];
      }
      
      if (!englishTrack || !englishTrack.baseUrl) {
        console.error('No suitable caption track found');
        return null;
      }
      
      // Download caption file
      console.log(`Downloading captions from: ${englishTrack.baseUrl}`);
      const captionResponse = await axios.get(englishTrack.baseUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      if (captionResponse.status !== 200) {
        console.error(`Failed to download captions: ${captionResponse.status}`);
        return null;
      }
      
      const captionContent = captionResponse.data;
      
      // Parse caption content
      return this.parseXmlCaptions(captionContent);
    } catch (error) {
      console.error(`Error in direct caption extraction: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  private parseXmlCaptions(xml: string): string | null {
    try {
      // Define interfaces for our data structures
      interface CaptionSegment {
        start: number;
        duration: number;
        text: string;
      }
      
      interface CaptionParagraph {
        startTime: number;
        text: string;
      }
      
      // Extract text segments with timing information from XML captions
      const segmentRegex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g;
      let match;
      const segments: CaptionSegment[] = [];
      
      while ((match = segmentRegex.exec(xml)) !== null) {
        segments.push({
          start: parseFloat(match[1]),
          duration: parseFloat(match[2]),
          text: this.decodeHtmlEntities(match[3])
        });
      }
      
      if (segments.length === 0) {
        console.error('No text segments found in XML');
        return null;
      }
      
      console.log(`Found ${segments.length} text segments with timing`);
      
      // Format time as MM:SS
      const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      
      // Look for sentence-ending punctuation and speaking patterns to help identify paragraph breaks
      const isSentenceEnd = (text: string): boolean => {
        return /[.!?]$/.test(text);
      };

      const isNewThought = (text: string): boolean => {
        // Look for common phrase starters that suggest new thoughts
        const starters = ['so ', 'but ', 'and ', 'now ', 'then ', 'well ', 'okay ', 'um ', 'uh ', 'next '];
        const lowerText = text.toLowerCase();
        return starters.some(starter => lowerText.startsWith(starter));
      };
      
      // Group segments into paragraphs more intelligently for single-speaker content
      const paragraphs: CaptionParagraph[] = [];
      let currentParagraphSegments: CaptionSegment[] = [];
      let lastEndTime = 0;
      let consecutiveSentenceEnds = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentEndTime = segment.start + segment.duration;
        
        // Add current segment to paragraph
        currentParagraphSegments.push(segment);
        
        // Check if we should start a new paragraph:
        // 1. Significant pause (2+ seconds)
        const hasSignificantPause = i < segments.length - 1 && segments[i + 1].start - segmentEndTime > 2;
        
        // 2. Speaker likely ended a thought (sentence end + pause)
        const hasCompletedThought = isSentenceEnd(segment.text) && 
          (i < segments.length - 1 && segments[i + 1].start - segmentEndTime > 0.5);
        
        // 3. New thought starting (after a sentence end)
        const isStartingNewThought = i < segments.length - 1 && 
          isSentenceEnd(segment.text) && 
          isNewThought(segments[i + 1].text);
        
        // 4. Multiple sentences in current paragraph
        if (isSentenceEnd(segment.text)) {
          consecutiveSentenceEnds++;
        }
        const hasMultipleSentences = consecutiveSentenceEnds >= 2 && currentParagraphSegments.length >= 3;
        
        // 5. Paragraph is getting too long
        const isLongParagraph = currentParagraphSegments.length >= 6;
        
        if (hasSignificantPause || hasCompletedThought || isStartingNewThought || 
            hasMultipleSentences || isLongParagraph) {
          // End current paragraph and start a new one
          if (currentParagraphSegments.length > 0) {
            const startTime = currentParagraphSegments[0].start;
            // Join the text with proper spacing
            const text = currentParagraphSegments.map(seg => seg.text.trim())
              .join(' ')
              .replace(/\s+/g, ' ') // Clean up extra spaces
              .replace(/ ([.,!?:;])/g, '$1'); // Remove spaces before punctuation
            
            paragraphs.push({ startTime, text });
            currentParagraphSegments = [];
            consecutiveSentenceEnds = 0;
          }
        }
        
        lastEndTime = segmentEndTime;
      }
      
      // Add any remaining segments as the final paragraph
      if (currentParagraphSegments.length > 0) {
        const startTime = currentParagraphSegments[0].start;
        const text = currentParagraphSegments.map(seg => seg.text.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .replace(/ ([.,!?:;])/g, '$1');
        
        paragraphs.push({ startTime, text });
      }
      
      // We'll assume single-speaker content for most transcripts
      // Format the transcript with timestamps and paragraphs
      let transcript = '';
      
      paragraphs.forEach((para, index) => {
        // Add timestamp at the beginning of each paragraph
        const timeMarker = `[${formatTime(para.startTime)}] `;
        transcript += timeMarker + para.text;
        
        // Add paragraph break (double newline) if not the last paragraph
        if (index < paragraphs.length - 1) {
          transcript += "\n\n";
        }
      });
      
      return transcript;
    } catch (error) {
      console.error(`Error parsing captions: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };
    
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, match => entities[match]);
  }
  
  private async getBasicMetadata(videoId: string): Promise<{ title: string | null; date: string | null; channel: string | null }> {
    try {
      // Use YouTube oEmbed API to get basic metadata
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      
      const response = await axios.get(oembedUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000
      });
      
      if (response.status === 200) {
        const data = response.data;
        return {
          title: data.title || null,
          date: new Date().toISOString().split('T')[0], // oEmbed doesn't provide date
          channel: data.author_name || null
        };
      }
    } catch (error) {
      console.error(`Error getting metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return { title: null, date: null, channel: null };
  }
} 
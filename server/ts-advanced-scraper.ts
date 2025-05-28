import axios from 'axios';
import * as cheerio from 'cheerio';
import { CaptionResult } from './ts-caption-scraper';

/**
 * Advanced caption scraper with additional techniques for hard-to-extract videos
 */
export class TsAdvancedScraper {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  
  /**
   * Extract captions using multiple advanced techniques
   */
  async extractCaptions(videoId: string): Promise<CaptionResult | null> {
    try {
      console.log(`Starting advanced caption extraction for video: ${videoId}`);
      
      // Try multiple extraction techniques in sequence
      const transcript = await this.tryMultipleExtractionMethods(videoId);
      
      if (!transcript || transcript.length < 50) {
        console.log('All advanced extraction methods failed');
        return null;
      }
      
      // Get metadata
      const metadata = await this.getEnhancedMetadata(videoId);
      
      return {
        transcript,
        title: metadata.title || `Video ${videoId}`,
        date: metadata.date || new Date().toISOString().split('T')[0],
        channel: metadata.channel || 'Unknown Channel',
        videoId,
        extractionMethod: 'advanced_scraping'
      };
    } catch (error) {
      console.error(`Advanced scraper error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Try multiple extraction methods in sequence
   */
  private async tryMultipleExtractionMethods(videoId: string): Promise<string | null> {
    // Method 1: Try timedtext API directly
    try {
      console.log('Trying timedtext API extraction...');
      const timedTextResult = await this.extractFromTimedTextApi(videoId);
      if (timedTextResult && timedTextResult.length > 100) {
        console.log(`Successfully extracted ${timedTextResult.length} chars using timedtext API`);
        return timedTextResult;
      }
    } catch (error) {
      console.log(`Timedtext API extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Method 2: Try embedded captions from watch page
    try {
      console.log('Trying embedded captions extraction...');
      const embeddedResult = await this.extractEmbeddedCaptions(videoId);
      if (embeddedResult && embeddedResult.length > 100) {
        console.log(`Successfully extracted ${embeddedResult.length} chars from embedded captions`);
        return embeddedResult;
      }
    } catch (error) {
      console.log(`Embedded captions extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Method 3: Try transcript page directly
    try {
      console.log('Trying transcript page extraction...');
      const transcriptPageResult = await this.extractFromTranscriptPage(videoId);
      if (transcriptPageResult && transcriptPageResult.length > 100) {
        console.log(`Successfully extracted ${transcriptPageResult.length} chars from transcript page`);
        return transcriptPageResult;
      }
    } catch (error) {
      console.log(`Transcript page extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('All extraction methods failed');
    return null;
  }
  
  /**
   * Extract captions directly from YouTube's timedtext API
   */
  private async extractFromTimedTextApi(videoId: string): Promise<string | null> {
    try {
      // First get video page to extract data needed for API call
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });
      
      const html = response.data;
      
      // Look for direct caption URLs in the page
      const captionUrlMatches = html.match(/"captionTracks":\s*\[\s*\{\s*"baseUrl":\s*"([^"]+)"/);
      if (!captionUrlMatches) {
        console.log('No caption URLs found in page source');
        return null;
      }
      
      // Extract and clean the caption URL
      let captionUrl = captionUrlMatches[1];
      captionUrl = captionUrl.replace(/\\u0026/g, '&');
      
      console.log(`Found caption URL: ${captionUrl.substring(0, 100)}...`);
      
      // Fetch the captions
      const captionResponse = await axios.get(captionUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      if (captionResponse.status !== 200) {
        console.log(`Caption request failed with status ${captionResponse.status}`);
        return null;
      }
      
      // Parse the XML response
      const captionXml = captionResponse.data;
      return this.parseXmlCaptions(captionXml);
    } catch (error) {
      console.error(`Error in timedtext extraction: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Extract captions embedded in the watch page
   */
  private async extractEmbeddedCaptions(videoId: string): Promise<string | null> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });
      
      const html = response.data;
      
      // Look for captions data in the ytInitialPlayerResponse
      const dataMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (!dataMatch) {
        console.log('No player data found');
        return null;
      }
      
      const playerData = JSON.parse(dataMatch[1]);
      
      // Extract transcript data if present
      if (playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        const tracks = playerData.captions.playerCaptionsTracklistRenderer.captionTracks;
        
        // Find English track
        let englishTrack = tracks.find((t: any) => 
          t.languageCode?.startsWith('en') && t.kind !== 'asr'
        );
        
        // Fallback to any English track
        if (!englishTrack) {
          englishTrack = tracks.find((t: any) => t.languageCode?.startsWith('en'));
        }
        
        // Fallback to any track
        if (!englishTrack && tracks.length > 0) {
          englishTrack = tracks[0];
        }
        
        if (englishTrack?.baseUrl) {
          console.log(`Found caption track URL: ${englishTrack.baseUrl.substring(0, 100)}...`);
          
          // Fetch caption data
          const captionResponse = await axios.get(englishTrack.baseUrl, {
            headers: { 'User-Agent': this.userAgent },
            timeout: 10000
          });
          
          return this.parseXmlCaptions(captionResponse.data);
        }
      }
      
      console.log('No caption tracks found in player data');
      return null;
    } catch (error) {
      console.error(`Error in embedded captions extraction: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Extract captions from the transcript page
   */
  private async extractFromTranscriptPage(videoId: string): Promise<string | null> {
    try {
      // This is a special endpoint that returns the transcript page
      const url = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });
      
      if (response.status !== 200) {
        console.log(`Transcript page request failed: ${response.status}`);
        return null;
      }
      
      const content = response.data;
      
      // If we got XML content directly
      if (typeof content === 'string' && content.includes('<text')) {
        return this.parseXmlCaptions(content);
      }
      
      // If we got JSON
      if (typeof content === 'object') {
        return this.parseJsonCaptions(content);
      }
      
      console.log('Unrecognized transcript format');
      return null;
    } catch (error) {
      console.error(`Error in transcript page extraction: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Parse XML format captions
   */
  private parseXmlCaptions(xml: string): string | null {
    try {
      // Extract all text elements
      const textMatches = xml.match(/<text[^>]*>([^<]+)<\/text>/g);
      
      if (!textMatches || textMatches.length === 0) {
        return null;
      }
      
      // Extract text content from tags
      const textContents = textMatches.map(match => {
        // Remove XML tags
        let text = match.replace(/<[^>]+>/g, '');
        
        // Decode HTML entities
        text = this.decodeHtmlEntities(text);
        
        return text;
      });
      
      // Join all text segments
      let transcript = textContents.join(' ');
      
      // Clean up whitespace
      transcript = transcript.replace(/\s+/g, ' ').trim();
      
      return transcript;
    } catch (error) {
      console.error(`Error parsing XML captions: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Parse JSON format captions (newer YouTube format)
   */
  private async parseJsonCaptions(json: any): Promise<string | null> {
    try {
      let textSegments: string[] = [];
      
      // Handle different JSON caption formats
      if (json.events) {
        // Format 1: events array with segs
        for (const event of json.events) {
          if (event.segs) {
            for (const seg of event.segs) {
              if (seg.utf8) {
                textSegments.push(seg.utf8);
              }
            }
          }
        }
      } else if (json.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        // Format 2: caption tracks array
        // We need to fetch the actual captions from the URL
        const tracks = json.captions.playerCaptionsTracklistRenderer.captionTracks;
        
        for (const track of tracks) {
          if (track.languageCode?.startsWith('en') && track.baseUrl) {
            // Fetch this caption track
            return await this.fetchAndParseTrack(track.baseUrl);
          }
        }
      }
      
      if (textSegments.length > 0) {
        return textSegments.join(' ').replace(/\s+/g, ' ').trim();
      }
      
      return null;
    } catch (error) {
      console.error(`Error parsing JSON captions: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Fetch and parse a caption track from URL
   */
  private async fetchAndParseTrack(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      if (response.status !== 200) {
        return null;
      }
      
      // Parse the content based on format
      const content = response.data;
      
      if (typeof content === 'string' && content.includes('<text')) {
        // XML format
        return this.parseXmlCaptions(content);
      } else if (typeof content === 'object') {
        // JSON format
        return this.parseJsonCaptions(content);
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching caption track: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Get enhanced metadata for the video
   */
  private async getEnhancedMetadata(videoId: string): Promise<{ title: string | null; date: string | null; channel: string | null }> {
    try {
      // Try oEmbed API first
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await axios.get(oembedUrl, { timeout: 5000 });
        
        if (response.status === 200) {
          return {
            title: response.data.title || null,
            date: new Date().toISOString().split('T')[0],
            channel: response.data.author_name || null
          };
        }
      } catch (error) {
        console.log('oEmbed API failed, trying page metadata');
      }
      
      // Fallback to page metadata
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      const html = response.data;
      
      // Extract metadata using regex
      const titleMatch = html.match(/"title":"([^"]+)"/);
      const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
      const dateMatch = html.match(/"publishDate":"([^"]+)"/);
      
      return {
        title: titleMatch ? this.decodeHtmlEntities(titleMatch[1]) : null,
        channel: channelMatch ? this.decodeHtmlEntities(channelMatch[1]) : null,
        date: dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error(`Error getting metadata: ${error instanceof Error ? error.message : String(error)}`);
      return { title: null, date: null, channel: null };
    }
  }
  
  /**
   * Decode HTML entities in text
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '\\u0026': '&'
    };
    
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;|\\u0026/g, match => entities[match]);
  }
} 
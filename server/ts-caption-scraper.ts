import axios from 'axios';
import * as cheerio from 'cheerio';
import { TranscriptFormatter, type FormattedTranscript } from './transcript-formatter';

interface CaptionTrack {
  languageCode: string;
  name?: string;
  kind?: string;
  baseUrl?: string;
}

export interface CaptionResult {
  transcript: string;
  formattedTranscript?: FormattedTranscript;
  title: string;
  date: string;
  channel: string;
  videoId: string;
  extractionMethod: string;
}

export class TsCaptionScraper {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  private formatter: TranscriptFormatter;
  
  constructor() {
    this.formatter = new TranscriptFormatter();
  }
  
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
      
      // Format the transcript using AI
      let formattedTranscript: FormattedTranscript | undefined;
      try {
        console.log('Formatting transcript with AI...');
        formattedTranscript = await this.formatter.formatTranscript(captionText);
        console.log(`Transcript formatted successfully: ${formattedTranscript.processingMetadata.wordCount} words, ${formattedTranscript.processingMetadata.paragraphCount} paragraphs`);
      } catch (error) {
        console.error('Failed to format transcript with AI:', error);
        // Continue without formatted transcript - the raw transcript will still be available
      }
      
      return {
        transcript: captionText, // Keep raw transcript for backward compatibility
        formattedTranscript,     // Add formatted version
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
      // Extract text from XML captions
      const textMatches = xml.match(/<text[^>]*>([^<]+)<\/text>/g);
      
      if (!textMatches || textMatches.length === 0) {
        console.error('No text matches found in XML');
        return null;
      }
      
      console.log(`Found ${textMatches.length} text segments`);
      
      // Extract text content from each match
      const textContents = textMatches.map(match => {
        // Remove XML tags
        const text = match.replace(/<[^>]+>/g, '');
        // Decode HTML entities
        return this.decodeHtmlEntities(text);
      });
      
      // Join text segments
      let transcript = textContents.join(' ');
      
      // Clean up whitespace
      transcript = transcript.replace(/\s+/g, ' ').trim();
      
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
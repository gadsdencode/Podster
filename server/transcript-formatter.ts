import OpenAI from 'openai';

export interface FormattedTranscript {
  raw: string;
  formatted: string;
  sentences: Sentence[];
  paragraphs: string[];
  processingMetadata: {
    formattingMethod: string;
    confidence: number;
    processedAt: string;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
  };
}

export interface Sentence {
  text: string;
  startTime?: number;
  endTime?: number;
  confidence?: number;
  index: number;
}

export class TranscriptFormatter {
  private openai: OpenAI;
  private readonly maxChunkSize = 4000; // Safe chunk size for API calls

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Main method to format a raw transcript
   */
  async formatTranscript(rawTranscript: string): Promise<FormattedTranscript> {
    try {
      console.log(`Starting transcript formatting for ${rawTranscript.length} characters`);
      
      if (!rawTranscript || rawTranscript.trim().length === 0) {
        throw new Error('Raw transcript is empty or invalid');
      }

      // Clean the raw transcript first
      const cleanedRaw = this.cleanRawTranscript(rawTranscript);
      
      // For very long transcripts, process in chunks
      const formattedText = await this.formatTextWithAI(cleanedRaw);
      
      // Extract sentences and paragraphs
      const sentences = this.extractSentences(formattedText);
      const paragraphs = this.extractParagraphs(formattedText);
      
      // Generate metadata
      const metadata = {
        formattingMethod: 'openai-gpt',
        confidence: 0.9, // High confidence for GPT formatting
        processedAt: new Date().toISOString(),
        wordCount: this.countWords(formattedText),
        sentenceCount: sentences.length,
        paragraphCount: paragraphs.length
      };

      console.log(`Formatting complete: ${metadata.wordCount} words, ${metadata.sentenceCount} sentences, ${metadata.paragraphCount} paragraphs`);

      return {
        raw: rawTranscript,
        formatted: formattedText,
        sentences,
        paragraphs,
        processingMetadata: metadata
      };
    } catch (error) {
      console.error('Error formatting transcript:', error);
      
      // Fallback to basic formatting if AI fails
      return this.fallbackFormat(rawTranscript);
    }
  }

  /**
   * Clean raw transcript of common issues
   */
  private cleanRawTranscript(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove common caption artifacts
      .replace(/\[.*?\]/g, '') // Remove [Music], [Applause], etc.
      .replace(/\(.*?\)/g, '') // Remove (inaudible), etc.
      // Clean up common issues
      .replace(/\b(um|uh|er|ah)\b/gi, '') // Remove filler words
      .replace(/\s+/g, ' ') // Normalize whitespace again
      .trim();
  }

  /**
   * Format text using OpenAI GPT
   */
  private async formatTextWithAI(text: string): Promise<string> {
    // If text is too long, process in chunks
    if (text.length > this.maxChunkSize) {
      return await this.formatLongText(text);
    }

    const prompt = this.createFormattingPrompt(text);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert transcript formatter. Your job is to take raw, unformatted transcript text and make it highly readable by adding proper punctuation, capitalization, and paragraph breaks while preserving the original meaning and natural speech patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent formatting
        max_tokens: 4000
      });

      const formattedText = response.choices[0]?.message?.content;
      if (!formattedText) {
        throw new Error('No formatted text received from OpenAI');
      }

      return formattedText.trim();
    } catch (error) {
      console.error('OpenAI formatting error:', error);
      throw error;
    }
  }

  /**
   * Handle long texts by processing in chunks
   */
  private async formatLongText(text: string): Promise<string> {
    const chunks = this.splitIntoChunks(text, this.maxChunkSize);
    const formattedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      
      try {
        const formattedChunk = await this.formatTextWithAI(chunks[i]);
        formattedChunks.push(formattedChunk);
        
        // Add delay between API calls to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        // Use fallback for this chunk
        formattedChunks.push(this.basicFormat(chunks[i]));
      }
    }

    return formattedChunks.join('\n\n');
  }

  /**
   * Split text into manageable chunks at sentence boundaries
   */
  private splitIntoChunks(text: string, maxSize: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      if (currentChunk.length + word.length + 1 > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Create formatting prompt for OpenAI
   */
  private createFormattingPrompt(text: string): string {
    return `Please format this podcast transcript by:

1. Adding proper punctuation (periods, commas, question marks, exclamation points)
2. Capitalizing the first letter of sentences and proper nouns
3. Creating paragraph breaks at natural topic transitions or speaker changes
4. Maintaining the conversational tone and natural speech patterns
5. Removing excessive filler words if they impede readability
6. Ensuring the text flows naturally and is easy to read

Raw transcript:
${text}

Please return only the formatted text without any additional commentary.`;
  }

  /**
   * Extract sentences from formatted text
   */
  private extractSentences(text: string): Sentence[] {
    // Split on sentence-ending punctuation
    const sentenceRegex = /[.!?]+/g;
    const sentences = text.split(sentenceRegex)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences.map((sentence, index) => ({
      text: sentence,
      index,
      confidence: 0.9
    }));
  }

  /**
   * Extract paragraphs from formatted text
   */
  private extractParagraphs(text: string): string[] {
    return text.split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Fallback formatting when AI fails
   */
  private fallbackFormat(rawText: string): FormattedTranscript {
    console.log('Using fallback formatting');
    
    const cleaned = this.cleanRawTranscript(rawText);
    const basicFormatted = this.basicFormat(cleaned);
    
    const sentences = this.extractSentences(basicFormatted);
    const paragraphs = this.extractParagraphs(basicFormatted);
    
    return {
      raw: rawText,
      formatted: basicFormatted,
      sentences,
      paragraphs,
      processingMetadata: {
        formattingMethod: 'fallback-basic',
        confidence: 0.6,
        processedAt: new Date().toISOString(),
        wordCount: this.countWords(basicFormatted),
        sentenceCount: sentences.length,
        paragraphCount: paragraphs.length
      }
    };
  }

  /**
   * Basic formatting without AI
   */
  private basicFormat(text: string): string {
    // Basic sentence detection and capitalization
    let formatted = text.toLowerCase();
    
    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    
    // Add periods at natural breaks (very basic)
    formatted = formatted.replace(/\s+(and|but|so|then|now|well|okay)\s+/gi, '. $1 ');
    
    // Capitalize after periods
    formatted = formatted.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());
    
    // Add paragraph breaks every ~200 words
    const words = formatted.split(' ');
    const paragraphs: string[] = [];
    
    for (let i = 0; i < words.length; i += 200) {
      const paragraph = words.slice(i, i + 200).join(' ');
      paragraphs.push(paragraph);
    }
    
    return paragraphs.join('\n\n');
  }

  /**
   * Quick format method for testing
   */
  async quickFormat(text: string): Promise<string> {
    const result = await this.formatTranscript(text);
    return result.formatted;
  }
} 
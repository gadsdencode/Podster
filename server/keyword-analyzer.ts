import { OpenAI } from 'openai';

// Simple in-memory cache for keyword analysis results
const analysisCache = new Map<string, AnalysisResult>();

export interface KeywordHighlight {
  keyword: string;
  category: 'important' | 'technical' | 'name' | 'concept' | 'action';
  confidence: number;
  positions: Array<{
    start: number;
    end: number;
  }>;
}

export interface AnalysisResult {
  keywords: KeywordHighlight[];
  categories: {
    important: string[];
    technical: string[];
    name: string[];
    concept: string[];
    action: string[];
  };
}

export class KeywordAnalyzer {
  private openai: OpenAI;
  private readonly timeout = 30000; // 30 second timeout
  private readonly maxChunkSize = 1500; // Reduced chunk size for faster processing
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
  }
  
  async analyzeText(transcript: string): Promise<AnalysisResult> {
    try {
      // Generate a cache key (use a hash of the transcript or first 100 chars)
      const cacheKey = transcript.substring(0, 100);
      
      // Check cache first
      if (analysisCache.has(cacheKey)) {
        console.log("Using cached keyword analysis");
        return analysisCache.get(cacheKey)!;
      }
      
      console.log(`Starting keyword analysis of ${transcript.length} characters`);
      
      // Limit transcript size if extremely large
      const trimmedTranscript = transcript.length > 10000 
        ? transcript.substring(0, 10000) + "..." 
        : transcript;
      
      // Split transcript into manageable chunks
      const chunks = this.splitIntoChunks(trimmedTranscript, this.maxChunkSize);
      console.log(`Split into ${chunks.length} chunks`);

      const allKeywords: KeywordHighlight[] = [];
      
      // Process only the first few chunks for very long texts
      const maxChunks = Math.min(chunks.length, 3);
      
      for (let i = 0; i < maxChunks; i++) {
        console.log(`Processing chunk ${i+1}/${maxChunks}`);
        try {
          // Add timeout handling
          const chunkKeywords = await Promise.race([
            this.analyzeChunk(chunks[i]),
            new Promise<KeywordHighlight[]>((_, reject) => 
              setTimeout(() => reject(new Error("Keyword analysis timeout")), this.timeout)
            )
          ]);
          allKeywords.push(...chunkKeywords);
        } catch (error) {
          console.error(`Error analyzing chunk ${i+1}:`, error);
          // Continue with other chunks if one fails
        }
      }

      // If we have no keywords but there are chunks, use a fallback approach
      if (allKeywords.length === 0 && chunks.length > 0) {
        console.log("Using fallback keyword extraction approach");
        allKeywords.push(...this.extractKeywordsFallback(trimmedTranscript));
      }

      // Merge duplicate keywords and find their positions
      const mergedKeywords = this.mergeAndFindPositions(allKeywords, trimmedTranscript);
      
      // Categorize keywords
      const categories = this.categorizeKeywords(mergedKeywords);

      const result = {
        keywords: mergedKeywords,
        categories
      };
      
      // Cache the result
      analysisCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error("Error analyzing keywords:", error);
      // Return a basic result instead of throwing
      return {
        keywords: [],
        categories: {
          important: [],
          technical: [],
          name: [],
          concept: [],
          action: []
        }
      };
    }
  }
  
  private splitIntoChunks(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  private async analyzeChunk(text: string): Promise<KeywordHighlight[]> {
    console.log(`Analyzing chunk of ${text.length} characters`);
    const startTime = Date.now();
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Using a faster model
        messages: [
          {
            role: "system",
            content: `Extract the most important keywords from the text. Categorize each as: important, technical, name, concept, or action. Provide a confidence score (0-1).

Return JSON format:
{
  "keywords": [
    {
      "keyword": "exact phrase",
      "category": "important|technical|name|concept|action",
      "confidence": 0.95
    }
  ]
}`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500 // Reduced for faster response
      }, {
        timeout: this.timeout // Set timeout as an option parameter instead
      });

      const processingTime = Date.now() - startTime;
      console.log(`OpenAI processing time: ${processingTime}ms`);

      const result = JSON.parse(response.choices[0].message.content || '{"keywords":[]}');
      
      return result.keywords.map((kw: any) => ({
        keyword: kw.keyword,
        category: kw.category as 'important' | 'technical' | 'name' | 'concept' | 'action',
        confidence: kw.confidence,
        positions: []
      }));
    } catch (error) {
      console.error(`OpenAI API error after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }
  
  // Simple fallback method that doesn't use AI
  private extractKeywordsFallback(text: string): KeywordHighlight[] {
    console.log("Using fallback keyword extraction");
    
    // Split into words and count frequencies
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length < 3) continue; // Skip short words
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
    
    // Convert to array and sort by frequency
    const sortedWords = Array.from(wordCounts.entries())
      .filter(([word, count]) => count > 1 && word.length > 3) // Only words that appear multiple times
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Top 20 words
    
    // Convert to keywords
    return sortedWords.map(([word, count]) => {
      // Assign a category based on simple rules
      let category: 'important' | 'technical' | 'name' | 'concept' | 'action' = 'important';
      
      // Simple heuristics for categorization
      if (/^[A-Z]/.test(word)) {
        category = 'name';
      } else if (/ing$/.test(word)) {
        category = 'action';
      } else if (/tion$|ment$|ity$|ism$/.test(word)) {
        category = 'concept';
      } else if (/ology$|ical$|tech|data|code/.test(word)) {
        category = 'technical';
      }
      
      return {
        keyword: word,
        category,
        confidence: Math.min(0.7, count / 50), // Scale confidence by frequency
        positions: []
      };
    });
  }
  
  private mergeAndFindPositions(keywords: KeywordHighlight[], fullText: string): KeywordHighlight[] {
    const keywordMap = new Map<string, KeywordHighlight>();
    
    // Merge duplicate keywords
    for (const keyword of keywords) {
      const key = keyword.keyword.toLowerCase();
      if (keywordMap.has(key)) {
        const existing = keywordMap.get(key)!;
        existing.confidence = Math.max(existing.confidence, keyword.confidence);
      } else {
        keywordMap.set(key, { ...keyword, positions: [] });
      }
    }
    
    // Find all positions of each keyword in the full text
    const result: KeywordHighlight[] = [];
    
    for (const keyword of Array.from(keywordMap.values())) {
      const positions = this.findAllPositions(fullText, keyword.keyword);
      if (positions.length > 0) {
        result.push({
          ...keyword,
          positions
        });
      }
    }
    
    return result.sort((a, b) => b.confidence - a.confidence);
  }
  
  private findAllPositions(text: string, keyword: string): Array<{start: number, end: number}> {
    const positions: Array<{start: number, end: number}> = [];
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let startIndex = 0;
    while (true) {
      const index = lowerText.indexOf(lowerKeyword, startIndex);
      if (index === -1) break;
      
      // Check if this is a whole word match
      const prevChar = index > 0 ? lowerText[index - 1] : ' ';
      const nextChar = index + lowerKeyword.length < lowerText.length 
        ? lowerText[index + lowerKeyword.length] 
        : ' ';
      
      // Strict word boundary check - only non-alphanumeric characters are boundaries
      const isPrevBoundary = /[^a-z0-9]/.test(prevChar);
      const isNextBoundary = /[^a-z0-9]/.test(nextChar);
      
      if (isPrevBoundary && isNextBoundary) {
        // Ensure we're using the exact length from the original text
        const exactKeyword = text.substring(index, index + keyword.length);
        positions.push({
          start: index,
          end: index + exactKeyword.length
        });
      }
      
      // Move past this occurrence to find the next one
      startIndex = index + 1;
    }
    
    return positions;
  }
  
  private categorizeKeywords(keywords: KeywordHighlight[]): AnalysisResult['categories'] {
    const categories: AnalysisResult['categories'] = {
      important: [],
      technical: [],
      name: [],
      concept: [],
      action: []
    };
    
    for (const keyword of keywords) {
      switch (keyword.category) {
        case 'important':
          categories.important.push(keyword.keyword);
          break;
        case 'technical':
          categories.technical.push(keyword.keyword);
          break;
        case 'name':
          categories.name.push(keyword.keyword);
          break;
        case 'concept':
          categories.concept.push(keyword.keyword);
          break;
        case 'action':
          categories.action.push(keyword.keyword);
          break;
      }
    }
    
    return categories;
  }
} 
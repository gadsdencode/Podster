import { OpenAI } from 'openai';

// Simple in-memory cache for keyword analysis results
const analysisCache = new Map<string, AnalysisResult>();
// Cache for AI-generated definitions
const definitionCache = new Map<string, string>();

export interface KeywordHighlight {
  keyword: string;
  category: 'important' | 'technical' | 'name' | 'concept' | 'action';
  confidence: number;
  positions: Array<{
    start: number;
    end: number;
  }>;
  definition?: string; // AI-generated definition for technical/concept keywords
  definitionType?: 'factual' | 'balanced' | 'descriptive' | 'biographical'; // Type of definition provided
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
  private readonly timeout = 25000; // Reduced to 25 seconds per chunk for better reliability
  private readonly maxChunkSize = 3500; // Reduced from 5000 for more reliable processing
  private readonly maxTranscriptLength = 150000; // Maximum transcript length (about 3-4 hours of content)
  private readonly maxChunksForFullAnalysis = 50; // Maximum chunks for complete analysis
  private readonly maxConcurrentChunks = 3; // Process up to 3 chunks in parallel
  private definitionGenerator: DefinitionGenerator;
  
  // Enhanced stop words and quality filters
  private readonly stopWords = new Set([
    // Single letters
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // Common words
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'out', 'off', 'down', 'across', 'behind', 'beyond',
    // Short words
    'is', 'it', 'be', 'do', 'go', 'we', 'me', 'he', 'she', 'his', 'her', 'him', 'you', 'your', 'my', 'our', 'us', 'am', 'are', 'was', 'were',
    'has', 'had', 'have', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'did', 'does', 'done',
    // Articles and pronouns
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'any', 'each',
    'every', 'some', 'many', 'much', 'more', 'most', 'few', 'less', 'least', 'no', 'not', 'only', 'own', 'other', 'such', 'same'
  ]);
  
  // List of potentially controversial terms that need balanced definitions
  private readonly controversialTerms = new Set([
    'dei', 'diversity equity inclusion', 'diversity, equity, and inclusion',
    'climate change', 'global warming', 'socialism', 'capitalism', 
    'feminism', 'patriarchy', 'systemic racism', 'white privilege',
    'critical race theory', 'crt', 'gender theory', 'transgender',
    'abortion', 'pro-life', 'pro-choice', 'gun control', 'second amendment',
    'immigration', 'border security', 'welfare', 'universal healthcare',
    'minimum wage', 'wealth inequality', 'tax reform', 'regulation',
    'free market', 'government intervention', 'social justice',
    'cancel culture', 'woke', 'political correctness', 'cultural appropriation',
    'affirmative action', 'reparations', 'voter id', 'election integrity'
  ]);
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
    this.definitionGenerator = new DefinitionGenerator(apiKey);
  }
  
  async analyzeText(transcript: string, options: { includeDefinitions?: boolean; includeInsights?: boolean } = {}): Promise<AnalysisResult> {
    try {
      // Generate a cache key (use a hash of the transcript or first 100 chars)
      const cacheKey = transcript.substring(0, 100) + (options.includeDefinitions ? '_with_defs' : '') + (options.includeInsights ? '_with_insights' : '');
      
      // Check cache first
      if (analysisCache.has(cacheKey)) {
        console.log("Using cached keyword analysis");
        return analysisCache.get(cacheKey)!;
      }
      
      console.log(`Starting AI keyword analysis of ${transcript.length} characters`);
      console.log(`Options: includeDefinitions=${options.includeDefinitions}, includeInsights=${options.includeInsights}`);
      
      // Handle very long transcripts
      let trimmedTranscript = transcript;
      let analysisStrategy = 'complete';
      
      if (transcript.length > this.maxTranscriptLength) {
        console.log(`Transcript is very long (${transcript.length} chars). Using intelligent sampling strategy.`);
        trimmedTranscript = this.intelligentSample(transcript);
        analysisStrategy = 'sampled';
      }
      
      // Split transcript into manageable chunks
      const chunks = this.splitIntoChunks(trimmedTranscript, this.maxChunkSize);
      console.log(`Split into ${chunks.length} chunks for AI analysis (strategy: ${analysisStrategy})`);

      const allKeywords: KeywordHighlight[] = [];
      let aiAnalysisSucceeded = false;
      let chunksProcessed = 0;
      let failedChunks = 0;
      
      // Determine how many chunks to process
      const chunksToProcess = Math.min(chunks.length, this.maxChunksForFullAnalysis);
      
      if (chunks.length > this.maxChunksForFullAnalysis) {
        console.log(`Large transcript detected. Processing ${chunksToProcess} of ${chunks.length} chunks with intelligent sampling.`);
      }
      
      // Process chunks with improved parallel processing and error recovery
      const chunkPromises: Promise<{ index: number; keywords: KeywordHighlight[] | null }>[] = [];
      
      for (let i = 0; i < chunksToProcess; i += this.maxConcurrentChunks) {
        const batchEnd = Math.min(i + this.maxConcurrentChunks, chunksToProcess);
        const batchPromises: Promise<{ index: number; keywords: KeywordHighlight[] | null }>[] = [];
        
        for (let j = i; j < batchEnd; j++) {
          const chunkIndex = this.getChunkIndex(j, chunks.length, chunksToProcess);
          console.log(`Processing chunk ${j+1}/${chunksToProcess} (actual chunk ${chunkIndex+1}/${chunks.length}) with AI`);
          
          const chunkPromise = this.processChunkWithRetry(chunks[chunkIndex], chunkIndex, options.includeInsights)
            .then(keywords => ({ index: chunkIndex, keywords }))
            .catch(error => {
              console.error(`Failed to process chunk ${chunkIndex+1} after retries:`, error);
              failedChunks++;
              return { index: chunkIndex, keywords: null };
            });
          
          batchPromises.push(chunkPromise);
        }
        
        // Wait for this batch to complete before starting the next
        const batchResults = await Promise.all(batchPromises);
        
        // Process results from this batch
        for (const result of batchResults) {
          if (result.keywords && result.keywords.length > 0) {
            const adjustedKeywords = this.adjustKeywordPositions(result.keywords, result.index, chunks);
            allKeywords.push(...adjustedKeywords);
            aiAnalysisSucceeded = true;
            chunksProcessed++;
            console.log(`AI analysis succeeded for chunk ${result.index+1}: ${result.keywords.length} keywords`);
          }
        }
        
        // Small delay between batches to be respectful to API limits
        if (batchEnd < chunksToProcess) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // If AI analysis completely failed, use pattern-based fallback
      if (!aiAnalysisSucceeded || allKeywords.length === 0) {
        console.log("AI analysis completely failed - using pattern-based fallback");
        allKeywords.push(...this.extractKeywordsFallback(trimmedTranscript));
      }

      // Merge duplicate keywords and find their positions in the full transcript
      const mergedKeywords = this.mergeAndFindPositions(allKeywords, transcript); // Use original transcript for position finding
      
      // Auto-generate definitions for technical and concept keywords if requested and AI succeeded
      let finalKeywords = mergedKeywords;
      if (options.includeDefinitions && aiAnalysisSucceeded) {
        console.log("Auto-generating enhanced definitions for technical, concept, and name keywords");
        try {
          finalKeywords = await this.definitionGenerator.generateDefinitionsForKeywords(
            mergedKeywords, 
            trimmedTranscript.substring(0, 500)
          );
          console.log(`Enhanced definitions generated for ${finalKeywords.filter(k => k.definition).length} keywords`);
        } catch (error) {
          console.error("Error auto-generating enhanced definitions:", error);
          // Continue with keywords without enhanced definitions
        }
      }
      
      // Categorize keywords
      const categories = this.categorizeKeywords(finalKeywords);

      const result = {
        keywords: finalKeywords,
        categories
      };
      
      // Add metadata about analysis quality
      (result as any).analysisMetadata = {
        aiAnalysisSucceeded,
        totalKeywords: finalKeywords.length,
        keywordsWithDefinitions: finalKeywords.filter(k => k.definition).length,
        analysisMethod: aiAnalysisSucceeded ? 'AI-powered' : 'pattern-based fallback',
        chunksProcessed,
        totalChunks: chunks.length,
        failedChunks,
        analysisStrategy,
        transcriptLength: transcript.length,
        coverage: chunksProcessed / chunks.length,
        processingTime: Date.now()
      };
      
      // Cache the result
      analysisCache.set(cacheKey, result);
      
      console.log(`Analysis complete: ${finalKeywords.length} keywords (${finalKeywords.filter(k => k.definition).length} with definitions)`);
      console.log(`Coverage: ${chunksProcessed}/${chunks.length} chunks (${Math.round((chunksProcessed / chunks.length) * 100)}%)`);
      if (failedChunks > 0) {
        console.log(`Failed chunks: ${failedChunks} (continued processing despite failures)`);
      }
      return result;
    } catch (error) {
      console.error("Critical error in keyword analysis:", error);
      // Return a minimal result with error information
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
  
  private async analyzeChunk(text: string, includeInsights: boolean = false): Promise<KeywordHighlight[]> {
    console.log(`Analyzing chunk of ${text.length} characters with AI definitions: ${includeInsights}`);
    const startTime = Date.now();
    
    try {
      const systemPrompt = includeInsights 
        ? `You are an expert at identifying and defining meaningful terms and concepts. Extract ONLY the most important and substantial keywords from the text.

QUALITY REQUIREMENTS:
- Keywords must be at least 3 characters long (except proper names which can be 2+)
- NO single letters, common words, or meaningless fragments
- Focus on substantial terms that would be useful to define
- Avoid articles (the, a, an), prepositions (in, on, at), and common verbs (is, are, was)
- Prioritize technical terms, concepts, proper names, and meaningful actions

Categorize each as: important, technical, name, concept, or action.

For each keyword, provide an appropriate definition based on its type:

TECHNICAL terms: Provide factual, objective definitions explaining what the term means technically.
Example: "machine learning": "A subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed."

CONTROVERSIAL/POLITICAL terms: Provide accurate, balanced definitions that acknowledge different perspectives.
Example: "diversity equity inclusion": "A framework aimed at creating fair treatment and full participation for all people. Supporters argue it addresses systemic inequalities and promotes fairness, while critics contend it can lead to reverse discrimination and divisive identity politics."

GENERAL CONCEPTS: Provide neutral, descriptive definitions within the context of the text.
Example: "leadership": "The ability to guide, influence, and direct others toward achieving common goals."

NAMES: Identify individuals mentioned in the text and their relevance.
Example: "Tom Brady": "Tom Brady is a retired American football player who won multiple Super Bowls with the New England Patriots."

Return JSON format with ONLY meaningful, substantial keywords:
{
  "keywords": [
    {
      "keyword": "exact meaningful phrase from text (3+ chars)",
      "category": "important|technical|name|concept|action",
      "confidence": 0.95,
      "definition": "Appropriate definition based on term type",
      "definitionType": "factual|balanced|descriptive|biographical"
    }
  ]
}`
        : `Extract ONLY the most important and meaningful keywords from the text. 

QUALITY REQUIREMENTS:
- Keywords must be at least 3 characters long (except proper names which can be 2+)
- NO single letters, common words, or meaningless fragments
- Focus on substantial terms: technical concepts, proper names, important actions
- Avoid articles, prepositions, and common verbs

Categorize each as: important, technical, name, concept, or action. Provide a confidence score (0-1).

Return JSON format with ONLY meaningful keywords:
{
  "keywords": [
    {
      "keyword": "exact meaningful phrase (3+ chars)",
      "category": "important|technical|name|concept|action",
      "confidence": 0.95
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Analyze this text and extract ONLY meaningful, substantial keywords (NO single letters or common words):\n\n${text}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Lower temperature for more consistent definitions
        max_tokens: includeInsights ? 1500 : 500 // More tokens for balanced definitions
      }, {
        timeout: this.timeout
      });

      const processingTime = Date.now() - startTime;
      console.log(`OpenAI processing time: ${processingTime}ms`);

      const result = JSON.parse(response.choices[0].message.content || '{"keywords":[]}');
      
      if (!result.keywords || !Array.isArray(result.keywords)) {
        console.error("Invalid AI response format:", result);
        throw new Error("Invalid AI response format");
      }
      
      const rawKeywords = result.keywords.map((kw: any) => {
        const keyword: KeywordHighlight = {
          keyword: kw.keyword,
          category: kw.category as 'important' | 'technical' | 'name' | 'concept' | 'action',
          confidence: kw.confidence,
          positions: []
        };
        
        // Add definition for technical/concept/name terms
        if (includeInsights && kw.definition && (kw.category === 'technical' || kw.category === 'concept' || kw.category === 'name')) {
          keyword.definition = kw.definition;
          keyword.definitionType = kw.definitionType || this.getDefinitionType(kw.keyword, kw.category);
          console.log(`Generated ${keyword.definitionType} definition for ${kw.keyword}: ${kw.definition.substring(0, 50)}...`);
        }
        
        return keyword;
      });
      
      // Apply quality filtering
      const filteredKeywords = this.filterKeywords(rawKeywords);
      
      console.log(`Successfully analyzed chunk: ${filteredKeywords.length} quality keywords, ${filteredKeywords.filter(k => k.definition).length} with definitions`);
      return filteredKeywords;
    } catch (error) {
      console.error(`OpenAI API error after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }
  
  // Intelligent sampling for very long transcripts
  private intelligentSample(transcript: string): string {
    const targetLength = this.maxTranscriptLength;
    const sampleRatio = targetLength / transcript.length;
    
    // Take samples from beginning, middle, and end
    const beginningLength = Math.floor(targetLength * 0.4);
    const middleLength = Math.floor(targetLength * 0.3);
    const endLength = Math.floor(targetLength * 0.3);
    
    const beginning = transcript.substring(0, beginningLength);
    const middleStart = Math.floor((transcript.length - middleLength) / 2);
    const middle = transcript.substring(middleStart, middleStart + middleLength);
    const end = transcript.substring(transcript.length - endLength);
    
    return beginning + '\n\n[... content sampled ...]\n\n' + middle + '\n\n[... content sampled ...]\n\n' + end;
  }
  
  // Get chunk index for intelligent sampling
  private getChunkIndex(currentIndex: number, totalChunks: number, chunksToProcess: number): number {
    if (chunksToProcess >= totalChunks) {
      return currentIndex; // Process all chunks sequentially
    }
    
    // Intelligent sampling: distribute chunks across the transcript
    const ratio = currentIndex / (chunksToProcess - 1);
    return Math.floor(ratio * (totalChunks - 1));
  }
  
  // Adjust keyword positions when processing sampled chunks
  private adjustKeywordPositions(keywords: KeywordHighlight[], chunkIndex: number, chunks: string[]): KeywordHighlight[] {
    // For now, return keywords as-is since we'll find positions in the full transcript later
    // This is a placeholder for more sophisticated position adjustment if needed
    return keywords.map(keyword => ({
      ...keyword,
      positions: [] // Will be recalculated in mergeAndFindPositions
    }));
  }
  
  // Enhanced fallback method that doesn't use frequency counting
  private extractKeywordsFallback(text: string): KeywordHighlight[] {
    console.log("AI analysis failed - using enhanced pattern-based keyword extraction");
    
    // Use simple pattern matching for technical terms instead of frequency counting
    const technicalPatterns = [
      /\b(API|SDK|HTTP|JSON|XML|SQL|NoSQL|REST|GraphQL|OAuth|JWT)\b/gi,
      /\b(React|Angular|Vue|Node\.js|JavaScript|TypeScript|Python|Java|C\+\+)\b/gi,
      /\b(machine learning|artificial intelligence|neural network|deep learning|algorithm)\b/gi,
      /\b(database|server|client|frontend|backend|microservice|container|docker)\b/gi,
      /\b(cloud computing|AWS|Azure|Google Cloud|DevOps|CI\/CD|deployment)\b/gi
    ];
    
    const conceptPatterns = [
      /\b(methodology|framework|architecture|design pattern|best practice)\b/gi,
      /\b(scalability|performance|security|optimization|efficiency)\b/gi,
      /\b(user experience|interface|workflow|process|strategy)\b/gi
    ];
    
    const rawKeywords: KeywordHighlight[] = [];
    
    // Extract technical terms
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!rawKeywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
            rawKeywords.push({
              keyword: match,
              category: 'technical',
              confidence: 0.6, // Lower confidence for pattern matching
              positions: [],
              definition: "AI analysis unavailable - technical term identified by pattern matching"
            });
          }
        });
      }
    });
    
    // Extract concept terms
    conceptPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!rawKeywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
            rawKeywords.push({
              keyword: match,
              category: 'concept',
              confidence: 0.6,
              positions: [],
              definition: "AI analysis unavailable - concept identified by pattern matching"
            });
          }
        });
      }
    });
    
    // Extract proper nouns (likely names) with better filtering
    const nameMatches = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g);
    if (nameMatches) {
      nameMatches.slice(0, 5).forEach(match => { // Limit to 5 names
        if (!rawKeywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
          rawKeywords.push({
            keyword: match,
            category: 'name',
            confidence: 0.7,
            positions: []
          });
        }
      });
    }
    
    // Apply quality filtering to fallback keywords
    const filteredKeywords = this.filterKeywords(rawKeywords);
    
    console.log(`Fallback extraction: ${rawKeywords.length} raw keywords -> ${filteredKeywords.length} quality keywords`);
    return filteredKeywords.slice(0, 15); // Limit total keywords
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

  private isControversialTerm(keyword: string): boolean {
    const lowerKeyword = keyword.toLowerCase();
    return this.controversialTerms.has(lowerKeyword) || 
           Array.from(this.controversialTerms).some(term => 
             lowerKeyword.includes(term) || term.includes(lowerKeyword)
           );
  }

  private getDefinitionType(keyword: string, category: string): 'factual' | 'balanced' | 'descriptive' | 'biographical' {
    if (this.isControversialTerm(keyword)) {
      return 'balanced';
    } else if (category === 'technical') {
      return 'factual';
    } else if (category === 'name') {
      return 'biographical';
    } else {
      return 'descriptive';
    }
  }

  // New method for processing chunks with retry logic
  private async processChunkWithRetry(chunk: string, chunkIndex: number, includeInsights: boolean = false): Promise<KeywordHighlight[]> {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const chunkKeywords = await Promise.race([
          this.analyzeChunk(chunk, includeInsights),
          new Promise<KeywordHighlight[]>((_, reject) => 
            setTimeout(() => reject(new Error("AI analysis timeout")), this.timeout)
          )
        ]);
        
        if (chunkKeywords && chunkKeywords.length > 0) {
          return chunkKeywords;
        }
      } catch (error) {
        console.error(`AI analysis failed for chunk ${chunkIndex+1}, attempt ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          // Try again with simpler options
          console.log(`Retrying chunk ${chunkIndex+1} with simpler analysis (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }
    
    throw new Error(`Failed to process chunk ${chunkIndex+1} after ${maxRetries} attempts`);
  }

  // New method to validate keyword quality
  private isValidKeyword(keyword: string, category: string): boolean {
    // Basic validation
    if (!keyword || typeof keyword !== 'string') {
      return false;
    }
    
    const trimmed = keyword.trim().toLowerCase();
    
    // Length validation - minimum 2 characters, but prefer 3+ for most categories
    const minLength = category === 'name' ? 2 : 3;
    if (trimmed.length < minLength) {
      console.log(`Rejected keyword "${keyword}": too short (${trimmed.length} chars, min: ${minLength})`);
      return false;
    }
    
    // Maximum reasonable length (avoid very long phrases)
    if (trimmed.length > 50) {
      console.log(`Rejected keyword "${keyword}": too long (${trimmed.length} chars)`);
      return false;
    }
    
    // Stop word check
    if (this.stopWords.has(trimmed)) {
      console.log(`Rejected keyword "${keyword}": stop word`);
      return false;
    }
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(trimmed)) {
      console.log(`Rejected keyword "${keyword}": no alphabetic characters`);
      return false;
    }
    
    // Reject single characters (even if not in stop words)
    if (trimmed.length === 1) {
      console.log(`Rejected keyword "${keyword}": single character`);
      return false;
    }
    
    // Reject purely numeric strings
    if (/^\d+$/.test(trimmed)) {
      console.log(`Rejected keyword "${keyword}": purely numeric`);
      return false;
    }
    
    // Reject strings with too many special characters
    const specialCharCount = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (specialCharCount > trimmed.length * 0.3) {
      console.log(`Rejected keyword "${keyword}": too many special characters`);
      return false;
    }
    
    // Category-specific validation
    if (category === 'name') {
      // Names should start with capital letter or be proper nouns
      if (!/^[A-Z]/.test(keyword) && !this.isKnownProperNoun(keyword)) {
        console.log(`Rejected name keyword "${keyword}": doesn't appear to be a proper noun`);
        return false;
      }
    }
    
    return true;
  }
  
  // Helper method to check for known proper nouns
  private isKnownProperNoun(keyword: string): boolean {
    const knownProperNouns = ['iPhone', 'iPad', 'API', 'CEO', 'CTO', 'AI', 'ML', 'UI', 'UX'];
    return knownProperNouns.some(noun => keyword.toLowerCase().includes(noun.toLowerCase()));
  }
  
  // Enhanced method to filter and validate keywords
  private filterKeywords(keywords: KeywordHighlight[]): KeywordHighlight[] {
    const filtered = keywords.filter(keyword => {
      if (!this.isValidKeyword(keyword.keyword, keyword.category)) {
        return false;
      }
      
      // Additional quality checks
      if (keyword.confidence < 0.3) {
        console.log(`Rejected keyword "${keyword.keyword}": low confidence (${keyword.confidence})`);
        return false;
      }
      
      return true;
    });
    
    console.log(`Filtered keywords: ${keywords.length} -> ${filtered.length} (removed ${keywords.length - filtered.length} low-quality keywords)`);
    return filtered;
  }
}

export class DefinitionGenerator {
  private openai: OpenAI;
  private readonly timeout = 15000; // 15 second timeout for definitions
  
  // List of potentially controversial terms that need balanced definitions
  private readonly controversialTerms = new Set([
    'dei', 'diversity equity inclusion', 'diversity, equity, and inclusion',
    'climate change', 'global warming', 'socialism', 'capitalism', 
    'feminism', 'patriarchy', 'systemic racism', 'white privilege',
    'critical race theory', 'crt', 'gender theory', 'transgender',
    'abortion', 'pro-life', 'pro-choice', 'gun control', 'second amendment',
    'immigration', 'border security', 'welfare', 'universal healthcare',
    'minimum wage', 'wealth inequality', 'tax reform', 'regulation',
    'free market', 'government intervention', 'social justice',
    'cancel culture', 'woke', 'political correctness', 'cultural appropriation',
    'affirmative action', 'reparations', 'voter id', 'election integrity'
  ]);
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
  }
  
  private isControversialTerm(keyword: string): boolean {
    const lowerKeyword = keyword.toLowerCase();
    return this.controversialTerms.has(lowerKeyword) || 
           Array.from(this.controversialTerms).some(term => 
             lowerKeyword.includes(term) || term.includes(lowerKeyword)
           );
  }
  
  async generateDefinition(keyword: string, category: 'technical' | 'concept' | 'name', context?: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = `${keyword.toLowerCase()}_${category}`;
      if (definitionCache.has(cacheKey)) {
        console.log(`Using cached definition for: ${keyword}`);
        return definitionCache.get(cacheKey)!;
      }
      
      console.log(`Generating definition for ${category} keyword: ${keyword}`);
      
      // Determine if this is a controversial term
      const isControversial = this.isControversialTerm(keyword);
      
      const systemPrompt = isControversial
        ? `You are an expert at providing balanced, multi-perspective definitions. For controversial or political terms, present multiple viewpoints fairly without taking sides. Acknowledge that different groups have different perspectives on these topics.`
        : category === 'technical' 
          ? `You are a technical expert. Provide a brief, clear definition (2-3 sentences max) for technical terms. Focus on practical understanding without being overly academic.`
          : category === 'name'
            ? `You are an expert at identifying people and their relevance. Provide brief, contextual information about individuals mentioned in content. Focus on who they are and their relevance to the topic being discussed.`
            : `You are an educational expert. Provide a brief, clear explanation (2-3 sentences max) for concepts. Make it accessible to a general audience while being accurate.`;
      
      const userPrompt = isControversial
        ? `Provide a balanced definition of "${keyword}" that acknowledges different perspectives. Format: "[Basic description]. Supporters argue [positive view], while critics contend [negative view]." ${context ? `Context: "${context.substring(0, 200)}..."` : ''}`
        : category === 'name'
          ? `Who is "${keyword}" and what is their relevance in this context? ${context ? `Context: "${context.substring(0, 300)}..."` : ''} Provide a brief description of who they are and why they're mentioned.`
          : context 
            ? `Define "${keyword}" in the context: "${context.substring(0, 200)}..."`
            : `Define "${keyword}"`;
      
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: category === 'name' ? 180 : isControversial ? 200 : 150 // More tokens for person descriptions
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Definition generation timeout")), this.timeout)
        )
      ]);

      const definition = response.choices[0].message.content?.trim() || `A ${category} term: ${keyword}`;
      
      // Cache the definition
      definitionCache.set(cacheKey, definition);
      
      console.log(`Generated ${isControversial ? 'balanced' : category === 'name' ? 'biographical' : 'factual'} definition for ${keyword}`);
      return definition;
    } catch (error) {
      console.error(`Error generating definition for ${keyword}:`, error);
      // Return a fallback definition
      if (category === 'name') {
        return `${keyword}: Person mentioned in this content. Unable to retrieve specific information.`;
      }
      return `${keyword}: A ${category} term.`;
    }
  }
  
  async generateDefinitionsForKeywords(keywords: KeywordHighlight[], context?: string): Promise<KeywordHighlight[]> {
    const results: KeywordHighlight[] = [];
    
    for (const keyword of keywords) {
      if (keyword.category === 'technical' || keyword.category === 'concept' || keyword.category === 'name') {
        try {
          const definition = await this.generateDefinition(keyword.keyword, keyword.category, context);
          const definitionType = this.isControversialTerm(keyword.keyword) ? 'balanced' : 
                                keyword.category === 'technical' ? 'factual' : 
                                keyword.category === 'name' ? 'biographical' : 'descriptive';
          results.push({ ...keyword, definition, definitionType });
        } catch (error) {
          console.error(`Failed to generate definition for ${keyword.keyword}:`, error);
          results.push(keyword); // Return without definition if generation fails
        }
      } else {
        results.push(keyword); // Other categories don't need definitions
      }
    }
    
    return results;
  }
  
  // Batch generate definitions for better performance
  async batchGenerateDefinitions(keywords: string[], categories: ('technical' | 'concept' | 'name')[], context?: string): Promise<Map<string, string>> {
    const definitions = new Map<string, string>();
    
    // Process in smaller batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchCategories = categories.slice(i, i + batchSize);
      
      const promises = batch.map((keyword, index) => 
        this.generateDefinition(keyword, batchCategories[index], context)
          .then(def => ({ keyword, definition: def }))
          .catch(err => {
            console.error(`Batch definition error for ${keyword}:`, err);
            const category = batchCategories[index];
            const fallback = category === 'name' 
              ? `${keyword}: Person mentioned in this content.`
              : `${keyword}: A ${category} term.`;
            return { keyword, definition: fallback };
          })
      );
      
      const results = await Promise.all(promises);
      results.forEach(({ keyword, definition }) => {
        definitions.set(keyword, definition);
      });
      
      // Small delay between batches to be respectful to API limits
      if (i + batchSize < keywords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return definitions;
  }
}

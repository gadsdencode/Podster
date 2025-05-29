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
  definitionType?: 'factual' | 'balanced' | 'descriptive'; // Type of definition provided
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
  private definitionGenerator: DefinitionGenerator;
  
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
      
      // Limit transcript size if extremely large
      const trimmedTranscript = transcript.length > 10000 
        ? transcript.substring(0, 10000) + "..." 
        : transcript;
      
      // Split transcript into manageable chunks
      const chunks = this.splitIntoChunks(trimmedTranscript, this.maxChunkSize);
      console.log(`Split into ${chunks.length} chunks for AI analysis`);

      const allKeywords: KeywordHighlight[] = [];
      let aiAnalysisSucceeded = false;
      
      // Process only the first few chunks for very long texts
      const maxChunks = Math.min(chunks.length, 3);
      
      for (let i = 0; i < maxChunks; i++) {
        console.log(`Processing chunk ${i+1}/${maxChunks} with AI`);
        try {
          // Add timeout handling
          const chunkKeywords = await Promise.race([
            this.analyzeChunk(chunks[i], options.includeInsights),
            new Promise<KeywordHighlight[]>((_, reject) => 
              setTimeout(() => reject(new Error("AI analysis timeout")), this.timeout)
            )
          ]);
          
          if (chunkKeywords && chunkKeywords.length > 0) {
            allKeywords.push(...chunkKeywords);
            aiAnalysisSucceeded = true;
            console.log(`AI analysis succeeded for chunk ${i+1}: ${chunkKeywords.length} keywords`);
          }
        } catch (error) {
          console.error(`AI analysis failed for chunk ${i+1}:`, error);
          
          // Try one more time for this chunk
          try {
            console.log(`Retrying AI analysis for chunk ${i+1}`);
            const retryKeywords = await this.analyzeChunk(chunks[i], false); // Retry without insights
            if (retryKeywords && retryKeywords.length > 0) {
              allKeywords.push(...retryKeywords);
              aiAnalysisSucceeded = true;
              console.log(`AI retry succeeded for chunk ${i+1}: ${retryKeywords.length} keywords`);
            }
          } catch (retryError) {
            console.error(`AI retry also failed for chunk ${i+1}:`, retryError);
          }
        }
      }

      // If AI analysis completely failed, use pattern-based fallback
      if (!aiAnalysisSucceeded || allKeywords.length === 0) {
        console.log("AI analysis completely failed - using pattern-based fallback");
        allKeywords.push(...this.extractKeywordsFallback(trimmedTranscript));
      }

      // Merge duplicate keywords and find their positions
      const mergedKeywords = this.mergeAndFindPositions(allKeywords, trimmedTranscript);
      
      // Auto-generate definitions for technical and concept keywords if requested and AI succeeded
      let finalKeywords = mergedKeywords;
      if (options.includeDefinitions && aiAnalysisSucceeded) {
        console.log("Auto-generating enhanced definitions for technical and concept keywords");
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
        analysisMethod: aiAnalysisSucceeded ? 'AI-powered' : 'pattern-based fallback'
      };
      
      // Cache the result
      analysisCache.set(cacheKey, result);
      
      console.log(`Analysis complete: ${finalKeywords.length} keywords (${finalKeywords.filter(k => k.definition).length} with definitions)`);
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
        ? `You are an expert at identifying and defining terms and concepts. Extract the most important keywords from the text and categorize each as: important, technical, name, concept, or action.

For each keyword, provide an appropriate definition based on its type:

TECHNICAL terms: Provide factual, objective definitions explaining what the term means technically.
Example: "machine learning": "A subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed."

CONTROVERSIAL/POLITICAL terms: Provide balanced definitions that acknowledge different perspectives.
Example: "diversity equity inclusion": "A framework aimed at creating fair treatment and full participation for all people. Supporters argue it addresses systemic inequalities and promotes fairness, while critics contend it can lead to reverse discrimination and divisive identity politics."

GENERAL CONCEPTS: Provide neutral, descriptive definitions.
Example: "leadership": "The ability to guide, influence, and direct others toward achieving common goals."

NAMES: No definitions needed for proper nouns/people.

Return JSON format:
{
  "keywords": [
    {
      "keyword": "exact phrase from text",
      "category": "important|technical|name|concept|action",
      "confidence": 0.95,
      "definition": "Appropriate definition based on term type",
      "definitionType": "factual|balanced|descriptive"
    }
  ]
}`
        : `Extract the most important keywords from the text. Categorize each as: important, technical, name, concept, or action. Provide a confidence score (0-1).

Return JSON format:
{
  "keywords": [
    {
      "keyword": "exact phrase",
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
            content: `Analyze this text and extract keywords with appropriate definitions:\n\n${text}`
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
      
      const keywords = result.keywords.map((kw: any) => {
        const keyword: KeywordHighlight = {
          keyword: kw.keyword,
          category: kw.category as 'important' | 'technical' | 'name' | 'concept' | 'action',
          confidence: kw.confidence,
          positions: []
        };
        
        // Add definition for technical/concept terms
        if (includeInsights && kw.definition && (kw.category === 'technical' || kw.category === 'concept')) {
          keyword.definition = kw.definition;
          keyword.definitionType = kw.definitionType || this.getDefinitionType(kw.keyword, kw.category);
          console.log(`Generated ${keyword.definitionType} definition for ${kw.keyword}: ${kw.definition.substring(0, 50)}...`);
        }
        
        return keyword;
      });
      
      console.log(`Successfully analyzed chunk: ${keywords.length} keywords, ${keywords.filter(k => k.definition).length} with definitions`);
      return keywords;
    } catch (error) {
      console.error(`OpenAI API error after ${Date.now() - startTime}ms:`, error);
      throw error;
    }
  }
  
  // Enhanced fallback method that doesn't use frequency counting
  private extractKeywordsFallback(text: string): KeywordHighlight[] {
    console.log("AI analysis failed - using basic keyword extraction without frequency counting");
    
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
    
    const keywords: KeywordHighlight[] = [];
    
    // Extract technical terms
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!keywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
            keywords.push({
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
          if (!keywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
            keywords.push({
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
    
    // Extract proper nouns (likely names)
    const nameMatches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
    if (nameMatches) {
      nameMatches.slice(0, 5).forEach(match => { // Limit to 5 names
        if (!keywords.find(k => k.keyword.toLowerCase() === match.toLowerCase())) {
          keywords.push({
            keyword: match,
            category: 'name',
            confidence: 0.7,
            positions: []
          });
        }
      });
    }
    
    console.log(`Fallback extraction found ${keywords.length} keywords using pattern matching`);
    return keywords.slice(0, 15); // Limit total keywords
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

  private getDefinitionType(keyword: string, category: string): 'factual' | 'balanced' | 'descriptive' {
    if (this.isControversialTerm(keyword)) {
      return 'balanced';
    } else if (category === 'technical') {
      return 'factual';
    } else {
      return 'descriptive';
    }
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
  
  async generateDefinition(keyword: string, category: 'technical' | 'concept', context?: string): Promise<string> {
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
          : `You are an educational expert. Provide a brief, clear explanation (2-3 sentences max) for concepts. Make it accessible to a general audience while being accurate.`;
      
      const userPrompt = isControversial
        ? `Provide a balanced definition of "${keyword}" that acknowledges different perspectives. Format: "[Basic description]. Supporters argue [positive view], while critics contend [negative view]." ${context ? `Context: "${context.substring(0, 200)}..."` : ''}`
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
          max_tokens: isControversial ? 200 : 150 // More tokens for balanced definitions
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Definition generation timeout")), this.timeout)
        )
      ]);

      const definition = response.choices[0].message.content?.trim() || `A ${category} term: ${keyword}`;
      
      // Cache the definition
      definitionCache.set(cacheKey, definition);
      
      console.log(`Generated ${isControversial ? 'balanced' : 'factual'} definition for ${keyword}`);
      return definition;
    } catch (error) {
      console.error(`Error generating definition for ${keyword}:`, error);
      // Return a fallback definition
      return `${keyword}: A ${category} term that appears in this content.`;
    }
  }
  
  async generateDefinitionsForKeywords(keywords: KeywordHighlight[], context?: string): Promise<KeywordHighlight[]> {
    const results: KeywordHighlight[] = [];
    
    for (const keyword of keywords) {
      if (keyword.category === 'technical' || keyword.category === 'concept') {
        try {
          const definition = await this.generateDefinition(keyword.keyword, keyword.category, context);
          const definitionType = this.isControversialTerm(keyword.keyword) ? 'balanced' : 
                                keyword.category === 'technical' ? 'factual' : 'descriptive';
          results.push({ ...keyword, definition, definitionType });
        } catch (error) {
          console.error(`Failed to generate definition for ${keyword.keyword}:`, error);
          results.push(keyword); // Return without definition if generation fails
        }
      } else {
        results.push(keyword); // Non-technical/concept keywords don't need definitions
      }
    }
    
    return results;
  }
  
  // Batch generate definitions for better performance
  async batchGenerateDefinitions(keywords: string[], categories: ('technical' | 'concept')[], context?: string): Promise<Map<string, string>> {
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
            return { keyword, definition: `${keyword}: A ${batchCategories[index]} term.` };
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
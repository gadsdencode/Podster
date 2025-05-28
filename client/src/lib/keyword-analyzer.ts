// Instead of using OpenAI directly in the browser, we'll call our backend
const API_BASE = "";

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
    names: string[];
    concepts: string[];
    actions: string[];
  };
}

export async function analyzeKeywords(transcript: string): Promise<AnalysisResult> {
  try {
    // Split transcript into manageable chunks if too long
    const maxChunkSize = 3000;
    const chunks = transcript.length > maxChunkSize 
      ? splitIntoChunks(transcript, maxChunkSize)
      : [transcript];

    const allKeywords: KeywordHighlight[] = [];
    
    for (const chunk of chunks) {
      const chunkKeywords = await analyzeChunk(chunk);
      allKeywords.push(...chunkKeywords);
    }

    // Merge duplicate keywords and find their positions in the full transcript
    const mergedKeywords = mergeAndFindPositions(allKeywords, transcript);
    
    // Categorize keywords
    const categories = categorizeKeywords(mergedKeywords);

    return {
      keywords: mergedKeywords,
      categories
    };
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    return {
      keywords: [],
      categories: {
        important: [],
        technical: [],
        names: [],
        concepts: [],
        actions: []
      }
    };
  }
}

async function analyzeChunk(text: string): Promise<KeywordHighlight[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert text analyst. Extract the most important keywords and phrases from the given text. 
        
        Categorize each keyword as:
        - important: Key concepts, main topics, critical information
        - technical: Technical terms, jargon, specialized vocabulary
        - name: Names of people, places, organizations, products
        - concept: Abstract ideas, theories, methodologies
        - action: Verbs describing important actions or processes
        
        Provide a confidence score (0-1) for each keyword's importance.
        Return only keywords that appear in the text, no invented terms.
        Focus on words and phrases that would help someone quickly understand the content.
        
        Respond with JSON in this format:
        {
          "keywords": [
            {
              "keyword": "exact phrase from text",
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
    max_tokens: 1000
  });

  const result = JSON.parse(response.choices[0].message.content || '{"keywords":[]}');
  
  return result.keywords.map((kw: any) => ({
    keyword: kw.keyword,
    category: kw.category,
    confidence: kw.confidence,
    positions: []
  }));
}

function splitIntoChunks(text: string, maxSize: number): string[] {
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

function mergeAndFindPositions(keywords: KeywordHighlight[], fullText: string): KeywordHighlight[] {
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
    const positions = findAllPositions(fullText, keyword.keyword);
    if (positions.length > 0) {
      result.push({
        ...keyword,
        positions
      });
    }
  }
  
  return result.sort((a, b) => b.confidence - a.confidence);
}

function findAllPositions(text: string, keyword: string): Array<{start: number, end: number}> {
  const positions: Array<{start: number, end: number}> = [];
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  let startIndex = 0;
  while (true) {
    const index = lowerText.indexOf(lowerKeyword, startIndex);
    if (index === -1) break;
    
    // Check if this is a whole word match
    const before = index > 0 ? lowerText[index - 1] : ' ';
    const after = index + lowerKeyword.length < lowerText.length 
      ? lowerText[index + lowerKeyword.length] 
      : ' ';
    
    const isWordBoundary = /\W/.test(before) && /\W/.test(after);
    
    if (isWordBoundary) {
      positions.push({
        start: index,
        end: index + keyword.length
      });
    }
    
    startIndex = index + 1;
  }
  
  return positions;
}

function categorizeKeywords(keywords: KeywordHighlight[]): AnalysisResult['categories'] {
  const categories: AnalysisResult['categories'] = {
    important: [],
    technical: [],
    names: [],
    concepts: [],
    actions: []
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
        categories.names.push(keyword.keyword);
        break;
      case 'concept':
        categories.concepts.push(keyword.keyword);
        break;
      case 'action':
        categories.actions.push(keyword.keyword);
        break;
    }
  }
  
  return categories;
}

export function highlightText(text: string, keywords: KeywordHighlight[]): string {
  if (!keywords || keywords.length === 0) return text;
  
  // Sort keywords by position (end to start) to avoid position shifting
  const allPositions: Array<{
    start: number;
    end: number;
    keyword: KeywordHighlight;
  }> = [];
  
  for (const keyword of keywords) {
    for (const position of keyword.positions) {
      allPositions.push({
        ...position,
        keyword
      });
    }
  }
  
  allPositions.sort((a, b) => b.start - a.start);
  
  let highlightedText = text;
  
  for (const position of allPositions) {
    const beforeText = highlightedText.substring(0, position.start);
    const keywordText = highlightedText.substring(position.start, position.end);
    const afterText = highlightedText.substring(position.end);
    
    const colorClass = getCategoryColor(position.keyword.category);
    const highlightedKeyword = `<span class="keyword-highlight ${colorClass}" title="${position.keyword.category} (${Math.round(position.keyword.confidence * 100)}% confidence)">${keywordText}</span>`;
    
    highlightedText = beforeText + highlightedKeyword + afterText;
  }
  
  return highlightedText;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'important':
      return 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-200';
    case 'technical':
      return 'bg-blue-200 dark:bg-blue-800/50 text-blue-900 dark:text-blue-200';
    case 'name':
      return 'bg-green-200 dark:bg-green-800/50 text-green-900 dark:text-green-200';
    case 'concept':
      return 'bg-purple-200 dark:bg-purple-800/50 text-purple-900 dark:text-purple-200';
    case 'action':
      return 'bg-red-200 dark:bg-red-800/50 text-red-900 dark:text-red-200';
    default:
      return 'bg-gray-200 dark:bg-gray-800/50 text-gray-900 dark:text-gray-200';
  }
}
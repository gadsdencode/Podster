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
    const response = await fetch('/api/analyze-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      throw new Error(`Failed to analyze keywords: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
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
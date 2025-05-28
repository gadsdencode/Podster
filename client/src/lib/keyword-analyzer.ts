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
    name: string[];
    concept: string[];
    action: string[];
  };
}

export interface AnalysisProgressCallback {
  (status: string, progress: number): void;
}

// Default timeout of 30 seconds
const DEFAULT_TIMEOUT = 30000;

export async function analyzeKeywords(
  transcript: string, 
  progressCallback?: AnalysisProgressCallback,
  timeout: number = DEFAULT_TIMEOUT
): Promise<AnalysisResult> {
  try {
    // Notify that we're starting
    progressCallback?.('Starting keyword analysis...', 10);
    
    // Create a controller to enable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Start the request
    progressCallback?.('Sending request to server...', 20);
    
    const response = await fetch('/api/analyze-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
      signal: controller.signal
    });

    // Clear the timeout since we got a response
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      progressCallback?.('Error from server', 0);
      throw new Error(`Failed to analyze keywords: ${response.statusText}`);
    }

    progressCallback?.('Processing results...', 80);
    const result = await response.json();
    
    // Analysis complete
    progressCallback?.('Analysis complete!', 100);
    return result;
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    
    // Check if this was an abort/timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      progressCallback?.('Analysis timed out. Using simplified analysis.', 90);
      return generateFallbackAnalysis(transcript);
    }
    
    // Other errors
    progressCallback?.('Analysis failed. Using simplified analysis.', 90);
    return generateFallbackAnalysis(transcript);
  }
}

function generateFallbackAnalysis(transcript: string): AnalysisResult {
  // Very basic fallback that just extracts frequent words
  const words = transcript.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCounts = new Map<string, number>();
  
  for (const word of words) {
    if (word.length < 4) continue; // Skip short words
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }
  
  // Get most frequent words
  const keywords = Array.from(wordCounts.entries())
    .filter(([word, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => {
      // Simple categorization
      let category: 'important' | 'technical' | 'name' | 'concept' | 'action' = 'important';
      
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
        confidence: Math.min(0.6, count / 30),
        positions: findAllPositions(transcript, word)
      };
    });
  
  // Create categories
  const categories: AnalysisResult['categories'] = {
    important: [],
    technical: [],
    name: [],
    concept: [],
    action: []
  };
  
  for (const kw of keywords) {
    switch (kw.category) {
      case 'important': categories.important.push(kw.keyword); break;
      case 'technical': categories.technical.push(kw.keyword); break;
      case 'name': categories.name.push(kw.keyword); break;
      case 'concept': categories.concept.push(kw.keyword); break;
      case 'action': categories.action.push(kw.keyword); break;
    }
  }
  
  return { keywords, categories };
}

function findAllPositions(text: string, keyword: string): Array<{start: number, end: number}> {
  const positions: Array<{start: number, end: number}> = [];
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  let startIndex = 0;
  while (true) {
    const index = lowerText.indexOf(lowerKeyword, startIndex);
    if (index === -1) break;
    
    // Check if this is a whole word match by examining the characters before and after
    const prevChar = index > 0 ? lowerText[index - 1] : ' ';
    const nextChar = index + lowerKeyword.length < lowerText.length 
      ? lowerText[index + lowerKeyword.length] 
      : ' ';
    
    // Word boundary is any non-alphanumeric character
    const isPrevBoundary = /[^a-z0-9]/.test(prevChar);
    const isNextBoundary = /[^a-z0-9]/.test(nextChar);
    
    // Only add if both boundaries are satisfied
    if (isPrevBoundary && isNextBoundary) {
      // Use the exact start and end indices for the keyword
      positions.push({
        start: index,
        end: index + keyword.length
      });
    }
    
    // Move past this occurrence to find the next one
    startIndex = index + 1;
  }
  
  return positions;
}

export function highlightText(text: string, keywords: KeywordHighlight[]): string {
  if (!keywords || keywords.length === 0) return text;
  
  // Collect all positions where highlights should be applied
  const allPositions: Array<{
    start: number;
    end: number;
    keyword: KeywordHighlight;
  }> = [];
  
  for (const keyword of keywords) {
    for (const position of keyword.positions) {
      // Double-check that the position points to the actual keyword
      const substr = text.substring(position.start, position.end);
      if (substr.toLowerCase() === keyword.keyword.toLowerCase()) {
        allPositions.push({
          ...position,
          keyword
        });
      } else {
        console.warn(`Position mismatch: expected "${keyword.keyword}" but found "${substr}"`);
      }
    }
  }
  
  // If no valid positions, return original text
  if (allPositions.length === 0) return text;
  
  // Sort positions from end to start to prevent index shifts when replacing
  allPositions.sort((a, b) => b.start - a.start);
  
  // Apply highlights from end to start (to avoid position shifts)
  let highlightedText = text;
  
  for (const position of allPositions) {
    // Extract the exact text we want to highlight
    const beforeText = highlightedText.substring(0, position.start);
    const keywordText = highlightedText.substring(position.start, position.end);
    const afterText = highlightedText.substring(position.end);
    
    // Get the appropriate CSS class for this category
    const colorClass = getCategoryColor(position.keyword.category);
    
    // Format the confidence for display
    const confidenceValue = Math.round(position.keyword.confidence * 100);
    
    // Properly escape the title text
    const safeCategory = escapeHtml(position.keyword.category);
    const titleText = `${safeCategory} (${confidenceValue}% confidence)`;
    
    // Build the HTML with proper escaping
    const highlightedKeyword = 
      '<span ' + 
      'class="keyword-highlight ' + escapeHtml(colorClass) + '" ' + 
      'title="' + escapeHtml(titleText) + '"' +
      '>' + 
      keywordText + 
      '</span>';
    
    // Replace just this occurrence
    highlightedText = beforeText + highlightedKeyword + afterText;
  }
  
  return highlightedText;
}

// Helper function to escape HTML special characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
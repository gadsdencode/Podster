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
  analysisMetadata?: {
    aiAnalysisSucceeded: boolean;
    totalKeywords: number;
    keywordsWithDefinitions: number;
    analysisMethod: string;
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
  timeout: number = DEFAULT_TIMEOUT,
  options: { includeDefinitions?: boolean; includeInsights?: boolean } = { includeDefinitions: true, includeInsights: true }
): Promise<AnalysisResult> {
  try {
    // Notify that we're starting
    progressCallback?.('Starting AI-powered keyword analysis...', 10);
    
    // Create a controller to enable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Start the request
    progressCallback?.('Analyzing keywords with AI definitions...', 30);
    
    const response = await fetch('/api/analyze-keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        transcript,
        includeDefinitions: options.includeDefinitions,
        includeInsights: options.includeInsights
      }),
      signal: controller.signal
    });

    // Clear the timeout since we got a response
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      progressCallback?.('Server error during analysis', 0);
      throw new Error(`Failed to analyze keywords: ${response.statusText}`);
    }

    progressCallback?.('Processing AI analysis results...', 80);
    const result = await response.json();
    
    // Check if AI analysis succeeded
    if (result.analysisMetadata) {
      const { aiAnalysisSucceeded, keywordsWithDefinitions, analysisMethod } = result.analysisMetadata;
      
      if (aiAnalysisSucceeded) {
        progressCallback?.(`AI analysis complete! ${keywordsWithDefinitions} definitions generated`, 100);
      } else {
        progressCallback?.(`Analysis complete using ${analysisMethod}`, 100);
        console.warn('AI analysis failed, using fallback method');
      }
    } else {
      progressCallback?.('Analysis complete!', 100);
    }
    
    return result;
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    
    // Check if this was an abort/timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      progressCallback?.('Analysis timed out. Trying basic analysis...', 90);
      return await tryBasicAnalysis(transcript, progressCallback);
    }
    
    // Other errors - try basic analysis as fallback
    progressCallback?.('AI analysis failed. Trying basic analysis...', 90);
    return await tryBasicAnalysis(transcript, progressCallback);
  }
}

// Helper function to try basic analysis as fallback
async function tryBasicAnalysis(transcript: string, progressCallback?: AnalysisProgressCallback): Promise<AnalysisResult> {
  try {
    const basicResponse = await fetch('/api/analyze-keywords-basic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });
    
    if (basicResponse.ok) {
      const result = await basicResponse.json();
      progressCallback?.('Basic analysis completed', 100);
      return result;
    }
  } catch (basicError) {
    console.error('Basic analysis also failed:', basicError);
  }
  
  // Final fallback
  progressCallback?.('All analysis methods failed', 0);
  return generateFallbackAnalysis(transcript);
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
  
  // Create an array of all positions with their categories
  interface HighlightPosition {
    start: number;
    end: number;
    category: string;
    keyword: string;
    confidence: number;
    definition?: string;
    definitionType?: string;
  }
  
  // Collect all positions
  const positions: HighlightPosition[] = [];
  for (const keyword of keywords) {
    for (const position of keyword.positions) {
      // Verify the position
      const actualText = text.substring(position.start, position.end);
      if (actualText.toLowerCase() === keyword.keyword.toLowerCase()) {
        positions.push({
          start: position.start,
          end: position.end,
          category: keyword.category,
          keyword: keyword.keyword,
          confidence: keyword.confidence,
          definition: keyword.definition,
          definitionType: keyword.definitionType
        });
      }
    }
  }
  
  // If no valid positions, return original text
  if (positions.length === 0) return text;
  
  // Sort positions by start index
  positions.sort((a, b) => a.start - b.start);
  
  // Handle overlapping highlights - resolve conflicts
  const resolvedPositions: HighlightPosition[] = [];
  for (const pos of positions) {
    // Check if this position overlaps with any previously added position
    let overlaps = false;
    for (const existingPos of resolvedPositions) {
      // Check for overlap
      if (pos.start < existingPos.end && pos.end > existingPos.start) {
        overlaps = true;
        break;
      }
    }
    
    // Only add non-overlapping positions
    if (!overlaps) {
      resolvedPositions.push(pos);
    }
  }
  
  // Build the highlighted text
  let result = '';
  let lastIndex = 0;
  
  for (const pos of resolvedPositions) {
    // Add text before this highlight
    result += text.substring(lastIndex, pos.start);
    
    // Add the highlighted portion
    const colorClass = getCategoryColor(pos.category);
    const confidenceValue = Math.round(pos.confidence * 100);
    
    // Create enhanced tooltip text with AI insights and definition type
    let titleText = createEnhancedTooltip(pos.category, confidenceValue, pos.definition, pos.definitionType);
    
    // Add data attributes for enhanced interactivity
    const hasDefinition = pos.definition ? 'true' : 'false';
    const definitionAttr = pos.definition ? `data-definition="${escapeHtml(pos.definition)}"` : '';
    const definitionTypeAttr = pos.definitionType ? `data-definition-type="${escapeHtml(pos.definitionType)}"` : '';
    
    result += `<span class="keyword-highlight ${escapeHtml(colorClass)}" title="${escapeHtml(titleText)}" data-has-definition="${hasDefinition}" ${definitionAttr} ${definitionTypeAttr} data-keyword="${escapeHtml(pos.keyword)}" data-category="${escapeHtml(pos.category)}" data-confidence="${confidenceValue}">`;
    result += text.substring(pos.start, pos.end);
    result += '</span>';
    
    // Update lastIndex
    lastIndex = pos.end;
  }
  
  // Add any remaining text
  result += text.substring(lastIndex);
  
  return result;
}

// Create enhanced tooltip content with AI insights and definition type indicators
function createEnhancedTooltip(category: string, confidence: number, definition?: string, definitionType?: string): string {
  const categoryDescriptions = {
    'important': 'Key term that appears frequently or has high relevance',
    'technical': 'Technical term, tool, or methodology',
    'name': 'Person, company, or proper noun',
    'concept': 'Abstract idea, theory, or principle',
    'action': 'Action, process, or activity'
  };
  
  let tooltip = `🏷️ ${category.toUpperCase()} (${confidence}% confidence)\n`;
  tooltip += `${categoryDescriptions[category as keyof typeof categoryDescriptions] || 'Identified keyword'}`;
  
  if (definition) {
    // Add definition type indicator
    const typeIndicator = definitionType === 'balanced' ? '⚖️ Balanced View' : 
                         definitionType === 'factual' ? '📚 Factual' : 
                         '📝 Descriptive';
    
    tooltip += `\n\n${typeIndicator}:\n${definition}`;
    
    if (definitionType === 'balanced') {
      tooltip += `\n\n💡 This definition presents multiple perspectives on a contested topic.`;
    }
  } else if (category === 'technical' || category === 'concept') {
    tooltip += `\n\n💡 Click "Generate Definitions" for AI explanation`;
  }
  
  return tooltip;
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

// Generate definitions for specific keywords
export async function generateDefinitions(
  keywords: KeywordHighlight[], 
  context?: string,
  progressCallback?: AnalysisProgressCallback
): Promise<Record<string, string>> {
  try {
    progressCallback?.('Generating definitions...', 0);
    
    const response = await fetch(`${API_BASE}/api/generate-definitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: keywords.filter(k => k.category === 'technical' || k.category === 'concept'),
        context
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    progressCallback?.('Definitions generated', 100);
    
    return result.definitions || {};
  } catch (error) {
    console.error('Error generating definitions:', error);
    throw error;
  }
}

// Enhanced keyword analysis with optional definitions
export async function analyzeKeywordsWithDefinitions(
  transcript: string,
  includeDefinitions: boolean = false,
  progressCallback?: AnalysisProgressCallback
): Promise<AnalysisResult> {
  try {
    progressCallback?.('Starting enhanced analysis...', 0);
    
    const response = await fetch(`${API_BASE}/api/analyze-keywords-with-definitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        includeDefinitions
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    progressCallback?.('Analysis complete', 100);
    
    return result;
  } catch (error) {
    console.error('Error in enhanced keyword analysis:', error);
    throw error;
  }
}
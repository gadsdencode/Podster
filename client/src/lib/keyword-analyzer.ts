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
  analysisMetadata?: {
    aiAnalysisSucceeded: boolean;
    totalKeywords: number;
    keywordsWithDefinitions: number;
    analysisMethod: string;
    chunksProcessed?: number;
    totalChunks?: number;
    analysisStrategy?: string;
    transcriptLength?: number;
    coverage?: number;
    failedChunks?: number;
  };
}

export interface AnalysisProgressCallback {
  (status: string, progress: number): void;
}

// Default timeout of 30 seconds
const DEFAULT_TIMEOUT = 30000;

// Client-side keyword quality validation
const STOP_WORDS = new Set([
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

// Client-side keyword validation function
function isValidKeyword(keyword: string, category: string): boolean {
  if (!keyword || typeof keyword !== 'string') {
    return false;
  }
  
  const trimmed = keyword.trim().toLowerCase();
  
  // Length validation
  const minLength = category === 'name' ? 2 : 3;
  if (trimmed.length < minLength || trimmed.length > 50) {
    console.log(`Client: Rejected keyword "${keyword}": invalid length`);
    return false;
  }
  
  // Stop word check
  if (STOP_WORDS.has(trimmed)) {
    console.log(`Client: Rejected keyword "${keyword}": stop word`);
    return false;
  }
  
  // Must contain letters
  if (!/[a-zA-Z]/.test(trimmed)) {
    console.log(`Client: Rejected keyword "${keyword}": no letters`);
    return false;
  }
  
  // Reject purely numeric
  if (/^\d+$/.test(trimmed)) {
    console.log(`Client: Rejected keyword "${keyword}": purely numeric`);
    return false;
  }
  
  return true;
}

// Enhanced keyword filtering function
function filterKeywords(keywords: KeywordHighlight[]): KeywordHighlight[] {
  const filtered = keywords.filter(keyword => {
    if (!isValidKeyword(keyword.keyword, keyword.category)) {
      return false;
    }
    
    // Additional quality checks
    if (keyword.confidence < 0.3) {
      console.log(`Client: Rejected keyword "${keyword.keyword}": low confidence`);
      return false;
    }
    
    return true;
  });
  
  if (filtered.length !== keywords.length) {
    console.log(`Client-side filtering: ${keywords.length} -> ${filtered.length} keywords (removed ${keywords.length - filtered.length} low-quality)`);
  }
  
  return filtered;
}

export async function analyzeKeywords(
  transcript: string, 
  progressCallback?: AnalysisProgressCallback,
  timeout?: number, // Now optional - will be calculated dynamically
  options: { includeDefinitions?: boolean; includeInsights?: boolean } = { includeDefinitions: true, includeInsights: true }
): Promise<AnalysisResult> {
  try {
    // Notify that we're starting
    const transcriptLength = transcript.length;
    const estimatedChunks = Math.ceil(transcriptLength / 3500); // Updated for new chunk size
    
    // Calculate dynamic timeout based on transcript length and estimated chunks
    const dynamicTimeout = timeout || Math.max(
      120000, // Minimum 2 minutes
      estimatedChunks * 30000 + 60000 // 30s per chunk + 1 minute buffer
    );
    
    console.log(`Dynamic timeout calculated: ${Math.round(dynamicTimeout/1000)}s for ${estimatedChunks} estimated chunks`);
    
    if (transcriptLength > 50000) {
      progressCallback?.(`Starting analysis of large transcript (${Math.round(transcriptLength/1000)}k chars, ~${estimatedChunks} chunks, timeout: ${Math.round(dynamicTimeout/1000)}s)...`, 5);
    } else {
      progressCallback?.('Starting AI-powered keyword analysis...', 10);
    }
    
    // Create a controller to enable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), dynamicTimeout);
    
    // Start the request
    if (transcriptLength > 100000) {
      progressCallback?.('Analyzing very large transcript with intelligent sampling...', 20);
    } else if (transcriptLength > 50000) {
      progressCallback?.('Analyzing large transcript - this may take several minutes...', 25);
    } else {
      progressCallback?.('Analyzing keywords with AI definitions...', 30);
    }
    
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
    
    // Apply client-side quality filtering as backup
    if (result.keywords && Array.isArray(result.keywords)) {
      const originalCount = result.keywords.length;
      result.keywords = filterKeywords(result.keywords);
      
      if (result.keywords.length !== originalCount) {
        console.log(`Client-side quality control: filtered ${originalCount} -> ${result.keywords.length} keywords`);
        
        // Update categories to reflect filtered keywords
        if (result.categories) {
          result.categories = {
            important: result.keywords.filter((k: KeywordHighlight) => k.category === 'important').map((k: KeywordHighlight) => k.keyword),
            technical: result.keywords.filter((k: KeywordHighlight) => k.category === 'technical').map((k: KeywordHighlight) => k.keyword),
            name: result.keywords.filter((k: KeywordHighlight) => k.category === 'name').map((k: KeywordHighlight) => k.keyword),
            concept: result.keywords.filter((k: KeywordHighlight) => k.category === 'concept').map((k: KeywordHighlight) => k.keyword),
            action: result.keywords.filter((k: KeywordHighlight) => k.category === 'action').map((k: KeywordHighlight) => k.keyword)
          };
        }
        
        // Update metadata if available
        if (result.analysisMetadata) {
          result.analysisMetadata.totalKeywords = result.keywords.length;
          result.analysisMetadata.keywordsWithDefinitions = result.keywords.filter((k: KeywordHighlight) => k.definition).length;
        }
      }
    }
    
    // Enhanced progress reporting with coverage information
    if (result.analysisMetadata) {
      const { 
        aiAnalysisSucceeded, 
        keywordsWithDefinitions, 
        analysisMethod, 
        chunksProcessed, 
        totalChunks, 
        failedChunks,
        analysisStrategy,
        coverage 
      } = result.analysisMetadata;
      
      if (aiAnalysisSucceeded) {
        const coveragePercent = coverage ? Math.round(coverage * 100) : 100;
        const strategyText = analysisStrategy === 'sampled' ? ' (intelligent sampling)' : '';
        const failureText = failedChunks > 0 ? ` • ${failedChunks} chunks failed but processing continued` : '';
        
        if (coveragePercent >= 90) {
          progressCallback?.(`✅ AI analysis complete! ${keywordsWithDefinitions} definitions generated. Coverage: ${coveragePercent}%${strategyText}${failureText}`, 100);
        } else if (coveragePercent >= 70) {
          progressCallback?.(`⚠️ AI analysis mostly complete! ${keywordsWithDefinitions} definitions generated. Coverage: ${coveragePercent}%${strategyText}${failureText}`, 100);
        } else {
          progressCallback?.(`⚠️ AI analysis partially complete! ${keywordsWithDefinitions} definitions generated. Coverage: ${coveragePercent}%${strategyText}${failureText}`, 100);
        }
      } else {
        progressCallback?.(`Analysis complete using ${analysisMethod}`, 100);
        console.warn('AI analysis failed, using fallback method');
      }
      
      // Log detailed analysis information
      if (chunksProcessed && totalChunks) {
        console.log(`Analysis coverage: ${chunksProcessed}/${totalChunks} chunks (${Math.round((chunksProcessed/totalChunks)*100)}%)`);
        if (failedChunks > 0) {
          console.log(`Failed chunks: ${failedChunks} (processing continued despite failures)`);
        }
        if (analysisStrategy === 'sampled') {
          console.log('Used intelligent sampling for very large transcript');
        }
      }
    } else {
      progressCallback?.('Analysis complete!', 100);
    }
    
    return result;
  } catch (error) {
    console.error('Error analyzing keywords:', error);
    
    // Check if this was an abort/timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      progressCallback?.('⏱️ Analysis took longer than expected. Attempting to retrieve partial results...', 90);
      
      // Try to get any partial results that might be available
      try {
        const partialResponse = await fetch('/api/analyze-keywords-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: transcript.substring(0, 1000) }) // Send a sample for cache lookup
        });
        
        if (partialResponse.ok) {
          const partialResult = await partialResponse.json();
          if (partialResult.keywords && partialResult.keywords.length > 0) {
            progressCallback?.('✅ Retrieved partial analysis results', 100);
            return partialResult;
          }
        }
      } catch (partialError) {
        console.log('No partial results available');
      }
      
      progressCallback?.('⏱️ Analysis timeout - trying basic analysis...', 90);
      return await tryBasicAnalysis(transcript, progressCallback);
    }
    
    // Other errors - try basic analysis as fallback
    progressCallback?.('❌ AI analysis failed - trying basic analysis...', 90);
    return await tryBasicAnalysis(transcript, progressCallback);
  }
}

// Helper function to try basic analysis as fallback
async function tryBasicAnalysis(transcript: string, progressCallback?: AnalysisProgressCallback): Promise<AnalysisResult> {
  try {
    progressCallback?.('Attempting basic keyword extraction...', 95);
    
    const basicResponse = await fetch('/api/analyze-keywords-basic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });
    
    if (basicResponse.ok) {
      const result = await basicResponse.json();
      progressCallback?.('✅ Basic analysis completed - limited definitions available', 100);
      return result;
    }
  } catch (basicError) {
    console.error('Basic analysis also failed:', basicError);
  }
  
  // Final fallback
  progressCallback?.('⚠️ Using offline keyword extraction - no AI definitions available', 100);
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
  const rawKeywords = Array.from(wordCounts.entries())
    .filter(([word, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20) // Get more initially since we'll filter
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
  
  // Apply quality filtering to fallback keywords
  const keywords = filterKeywords(rawKeywords);
  
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
  
  if (definition) {
    // Add definition type indicator
    const typeIndicator = definitionType === 'balanced' ? '⚖️ Balanced View' : 
                         definitionType === 'factual' ? '📚 Factual' : 
                         definitionType === 'biographical' ? '👤 Person Info' :
                         '📝 Descriptive';
    
    tooltip += `\n${typeIndicator}:\n${definition}`;
    
    if (definitionType === 'balanced') {
      tooltip += `\n\n💡 This definition presents multiple perspectives on a contested topic.`;
    } else if (definitionType === 'biographical') {
      tooltip += `\n\n💡 AI-generated information about this person and their relevance.`;
    }
  } else {
    // Show category description only if no AI definition is available
    tooltip += `${categoryDescriptions[category as keyof typeof categoryDescriptions] || 'Identified keyword'}`;
    
    if (category === 'technical' || category === 'concept' || category === 'name') {
      tooltip += `\n\n💡 Click "Generate Definitions" for AI explanation`;
    }
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
    progressCallback?.('Generating AI definitions...', 10);
    
    const response = await fetch('/api/generate-definitions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        keywords,
        context 
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate definitions: ${response.statusText}`);
    }

    progressCallback?.('Processing definitions...', 80);
    const result = await response.json();
    
    progressCallback?.('Definitions generated successfully', 100);
    return result.definitions || {};
  } catch (error: any) {
    console.error('Error generating definitions:', error);
    throw new Error(`Failed to generate definitions: ${error.message}`);
  }
}

// New function to generate definitions for existing episode keywords
export async function generateDefinitionsForEpisode(
  episodeId: number,
  progressCallback?: AnalysisProgressCallback
): Promise<{ keywords: KeywordHighlight[], newDefinitions: Record<string, string> }> {
  try {
    progressCallback?.('Generating definitions for existing keywords...', 10);
    
    const response = await fetch(`/api/episodes/${episodeId}/generate-definitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to generate definitions: ${response.statusText}`);
    }

    progressCallback?.('Processing definitions...', 80);
    const result = await response.json();
    
    progressCallback?.('Definitions generated successfully', 100);
    return {
      keywords: result.keywords || [],
      newDefinitions: result.newDefinitions || {}
    };
  } catch (error: any) {
    console.error('Error generating definitions for episode:', error);
    throw new Error(`Failed to generate definitions: ${error.message}`);
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
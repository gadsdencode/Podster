import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Filter, RotateCcw, Clock, User, MessageSquare, Wand2 } from "lucide-react";
import { analyzeKeywords, highlightText, type AnalysisResult, type AnalysisProgressCallback } from "@/lib/keyword-analyzer";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface HighlightedTranscriptProps {
  transcript: string;
  initialAnalyzeMode?: boolean;
  isEnhanced?: boolean;
}

export default function HighlightedTranscript({ 
  transcript, 
  initialAnalyzeMode = false, 
  isEnhanced = false 
}: HighlightedTranscriptProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['important', 'technical', 'name', 'concept', 'action']));
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);
  const [compactMode, setCompactMode] = useState<boolean>(false);

  // Start analysis automatically if initialAnalyzeMode is true
  useEffect(() => {
    if (initialAnalyzeMode && !analysis && !isAnalyzing) {
      handleAnalyze();
    }
  }, [initialAnalyzeMode, analysis, isAnalyzing]);
  
  // Reset analysis when transcript changes
  useEffect(() => {
    if (analysis) {
      // Re-analyze if transcript changes and analysis was previously performed
      setAnalysis(null);
      setShowHighlights(false);
      if (initialAnalyzeMode) {
        handleAnalyze();
      }
    }
  }, [transcript]);

  const handleProgressUpdate: AnalysisProgressCallback = (status, progress) => {
    setProgressStatus(status);
    setProgressValue(progress);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgressValue(0);
    setProgressStatus('Preparing to analyze...');
    
    try {
      const result = await analyzeKeywords(transcript, handleProgressUpdate);
      setAnalysis(result);
      setShowHighlights(true);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze keywords');
      console.error('Keyword analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const getFilteredKeywords = () => {
    if (!analysis) return [];
    return analysis.keywords.filter(keyword => selectedCategories.has(keyword.category));
  };

  const getHighlightedText = () => {
    if (!analysis || !showHighlights) return transcript;
    const filteredKeywords = getFilteredKeywords();
    return highlightText(transcript, filteredKeywords);
  };

  // Check if the transcript has timestamp formatting
  const hasTimestamps = () => {
    return transcript.includes('[') && /\[\d+:\d+\]/.test(transcript);
  };

  // Check if the transcript appears to be enhanced
  const isEnhancedTranscript = () => {
    return isEnhanced || (
      // Enhanced transcripts typically have better capitalization and punctuation
      (transcript.includes('.') && 
       transcript.includes(',') &&
       // Check for proper capitalization after periods
       /\.\s[A-Z]/.test(transcript))
    );
  };

  // Format transcript with clean, consistent design
  const formatTranscript = (textToFormat: string) => {
    if (!hasTimestamps()) {
      // If no timestamps, just return the text as a paragraph with proper spacing
      return (
        <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
          {textToFormat}
        </div>
      );
    }

    // Extract paragraphs
    const paragraphs = textToFormat.split(/\n\n+/); // Handle any number of newlines
    
    return (
      <div className="space-y-6">
        {paragraphs.map((paragraph, index) => {
          // Check if paragraph starts with a timestamp [MM:SS]
          const timestampMatch = paragraph.match(/^\[(\d+:\d+)\]/) || paragraph.match(/\[(\d+:\d+)\]/);
          
          if (!timestampMatch) {
            // No timestamp, just return the paragraph
            return (
              <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {paragraph}
              </p>
            );
          }
          
          const timestamp = timestampMatch[1];
          // For enhanced transcripts, timestamps might not be at the beginning
          const text = paragraph.startsWith(`[${timestamp}]`) 
            ? paragraph.replace(/^\[\d+:\d+\]\s*/, '').trim()
            : paragraph;
          
          return (
            <div 
              key={index} 
              className="group relative flex transcript-paragraph"
            >
              <div className={cn(
                "flex-none w-16 text-right pr-4 text-gray-500 dark:text-gray-400 text-sm font-mono",
                "transition-opacity",
                compactMode ? "opacity-50 group-hover:opacity-100" : ""
              )}>
                <div className="flex items-center justify-end">
                  <Clock className="w-3 h-3 mr-1 inline" />
                  <span>{timestamp}</span>
                </div>
              </div>
              
              <div className={cn(
                "flex-grow border-l-2 border-gray-200 dark:border-gray-700 pl-4 pb-6",
                "relative"
              )}>
                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Format highlighted text
  const formatHighlightedText = () => {
    const highlightedText = getHighlightedText();
    
    if (!hasTimestamps()) {
      // If no timestamps, just return the highlighted text
      return (
        <div 
          className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightedText }} 
        />
      );
    }

    // Extract paragraphs
    const paragraphs = highlightedText.split(/\n\n+/); // Handle any number of newlines
    
    return (
      <div className="space-y-6">
        {paragraphs.map((paragraph, index) => {
          // Check if paragraph starts with a timestamp [MM:SS] or contains a timestamp
          const timestampMatch = paragraph.match(/^\[(\d+:\d+)\]/) || paragraph.match(/\[(\d+:\d+)\]/);
          
          if (!timestampMatch) {
            // No timestamp, just return the paragraph with highlighting
            return (
              <div
                key={index}
                className="text-gray-700 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: paragraph }}
              />
            );
          }
          
          const timestamp = timestampMatch[1];
          // For enhanced transcripts, timestamps might not be at the beginning
          let content: string;
          if (paragraph.startsWith(`[${timestamp}]`)) {
            // Standard format - timestamp at beginning
            content = paragraph.replace(/^\[\d+:\d+\]\s*/, '').trim();
          } else {
            // Enhanced format - timestamp may be within the text
            // Keep the whole paragraph as HTML entities might be affected by splitting
            content = paragraph;
          }
          
          if (paragraph.startsWith(`[${timestamp}]`)) {
            return (
              <div 
                key={index} 
                className="group relative flex transcript-paragraph"
              >
                <div className={cn(
                  "flex-none w-16 text-right pr-4 text-gray-500 dark:text-gray-400 text-sm font-mono",
                  "transition-opacity",
                  compactMode ? "opacity-50 group-hover:opacity-100" : ""
                )}>
                  <div className="flex items-center justify-end">
                    <Clock className="w-3 h-3 mr-1 inline" />
                    <span>{timestamp}</span>
                  </div>
                </div>
                
                <div className={cn(
                  "flex-grow border-l-2 border-gray-200 dark:border-gray-700 pl-4 pb-6",
                  "relative"
                )}>
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                  <div 
                    className="text-gray-700 dark:text-gray-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </div>
              </div>
            );
          } else {
            // Alternative rendering for enhanced transcripts with embedded timestamps
            return (
              <div 
                key={index} 
                className="transcript-paragraph py-3"
              >
                <div 
                  className="text-gray-700 dark:text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </div>
            );
          }
        })}
      </div>
    );
  };

  const getCategoryStats = (): Record<string, number> => {
    if (!analysis) return { important: 0, technical: 0, name: 0, concept: 0, action: 0 };
    return {
      important: analysis.categories.important.length,
      technical: analysis.categories.technical.length,
      name: analysis.categories.name.length,
      concept: analysis.categories.concept.length,
      action: analysis.categories.action.length
    };
  };

  const categoryColors: Record<string, string> = {
    important: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    technical: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    name: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    concept: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    action: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
  };

  const categoryLabels = {
    important: 'Important',
    technical: 'Technical',
    name: 'Names',
    concept: 'Concepts',
    action: 'Actions'
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          {!isAnalyzing && !analysis && (
            <Button
              onClick={handleAnalyze}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze Keywords</span>
            </Button>
          )}
          
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressStatus}</span>
              <Progress value={progressValue} className="w-32 h-2" />
            </div>
          )}
          
          {analysis && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHighlights(!showHighlights)}
                className={cn(
                  "flex items-center gap-1",
                  showHighlights 
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" 
                    : "text-gray-600 dark:text-gray-400"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {showHighlights ? "Hide Highlights" : "Show Highlights"}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompactMode(!compactMode)}
                className="text-gray-600 dark:text-gray-400"
              >
                {compactMode ? "Expand View" : "Compact View"}
              </Button>
              
              {isEnhancedTranscript() && analysis && showHighlights && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800">
                  <Wand2 className="w-3 h-3 mr-1" />
                  Enhanced + Analyzed
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {analysis && showHighlights && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filter:</span>
            {Object.keys(categoryColors).map(category => (
              <Badge
                key={category}
                variant="outline"
                className={cn(
                  "cursor-pointer",
                  selectedCategories.has(category) ? categoryColors[category] : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                )}
                onClick={() => toggleCategory(category)}
              >
                {getCategoryLabel(category)}
                <span className="ml-1 text-xs">
                  ({getCategoryStats()[category] || 0})
                </span>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setAnalysis(null);
                setShowHighlights(false);
              }}
              className="w-6 h-6 rounded-full text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Transcript display */}
      <div>
        {analysis && showHighlights ? formatHighlightedText() : formatTranscript(transcript)}
      </div>
    </div>
  );
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'important': return 'Important';
    case 'technical': return 'Technical';
    case 'name': return 'Names';
    case 'concept': return 'Concepts';
    case 'action': return 'Actions';
    default: return category;
  }
}

function getCategoryColorClass(category: string): string {
  switch (category) {
    case 'important': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
    case 'technical': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
    case 'name': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
    case 'concept': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
    case 'action': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
    default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700';
  }
}

function getCategoryBgClass(category: string): string {
  switch (category) {
    case 'important': return 'bg-yellow-200';
    case 'technical': return 'bg-blue-200';
    case 'name': return 'bg-green-200';
    case 'concept': return 'bg-purple-200';
    case 'action': return 'bg-red-200';
    default: return 'bg-gray-200';
  }
}
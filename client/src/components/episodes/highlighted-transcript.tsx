import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Filter, RotateCcw } from "lucide-react";
import { analyzeKeywords, highlightText, type AnalysisResult, type AnalysisProgressCallback } from "@/lib/keyword-analyzer";
import { Progress } from "@/components/ui/progress";

interface HighlightedTranscriptProps {
  transcript: string;
}

export default function HighlightedTranscript({ transcript }: HighlightedTranscriptProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['important', 'technical', 'name', 'concept', 'action']));
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);

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

  const getCategoryStats = () => {
    if (!analysis) return {};
    return {
      important: analysis.categories.important.length,
      technical: analysis.categories.technical.length,
      name: analysis.categories.name.length,
      concept: analysis.categories.concept.length,
      action: analysis.categories.action.length
    };
  };

  const categoryColors = {
    important: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    technical: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    names: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    concepts: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    actions: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
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
              Analyze Keywords
            </Button>
          )}
          
          {isAnalyzing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressStatus}</span>
              </div>
              <Progress value={progressValue} className="w-[250px] h-2" />
            </div>
          )}
          
          {error && (
            <div className="text-red-500 text-sm flex items-center gap-2">
              <span>Error: {error}</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAnalyze}
                className="h-7 px-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {analysis && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHighlights(!showHighlights)}
              className="h-8"
            >
              {showHighlights ? 'Hide Highlights' : 'Show Highlights'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAnalysis(null);
                setShowHighlights(false);
                setProgressValue(0);
                setProgressStatus('');
              }}
              className="h-8"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
            
            <div className="ml-auto flex items-center">
              <Filter className="w-4 h-4 mr-1 text-gray-500" />
              <span className="text-xs text-gray-500 mr-2">Filter:</span>
              {['important', 'technical', 'name', 'concept', 'action'].map((category) => {
                const stats = getCategoryStats();
                const count = stats[category as keyof typeof stats] || 0;
                return (
                  <Badge
                    key={category}
                    variant={selectedCategories.has(category) ? "default" : "outline"}
                    className={`mr-1 cursor-pointer ${getCategoryColorClass(category)}`}
                    onClick={() => toggleCategory(category)}
                  >
                    {getCategoryLabel(category)} ({count})
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Category Filters */}
      {analysis && (
        <div className="flex justify-between items-center">
          {analysis && getFilteredKeywords().length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Showing {getFilteredKeywords().length} keywords
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="bg-white/50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
        <div 
          className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed font-mono text-sm bg-gray-50 dark:bg-gray-900/50 p-4 rounded border"
          dangerouslySetInnerHTML={{ 
            __html: getHighlightedText()
          }}
        />
      </div>

      {/* Keyword Legend */}
      {analysis && showHighlights && getFilteredKeywords().length > 0 && (
        <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900/20 dark:to-blue-900/20 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Keyword Legend
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {['important', 'technical', 'name', 'concept', 'action'].map((category) => (
              <div key={category} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${getCategoryBgClass(category)}`} />
                <span>{getCategoryLabel(category)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS for keyword highlights */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .keyword-highlight {
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 500;
          cursor: help;
          transition: all 0.2s ease;
        }
        .keyword-highlight:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        `
      }} />
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
    case 'important': return 'bg-yellow-500 hover:bg-yellow-600';
    case 'technical': return 'bg-blue-500 hover:bg-blue-600';
    case 'name': return 'bg-green-500 hover:bg-green-600';
    case 'concept': return 'bg-purple-500 hover:bg-purple-600';
    case 'action': return 'bg-red-500 hover:bg-red-600';
    default: return 'bg-gray-500 hover:bg-gray-600';
  }
}

function getCategoryBgClass(category: string): string {
  switch (category) {
    case 'important': return 'bg-yellow-500';
    case 'technical': return 'bg-blue-500';
    case 'name': return 'bg-green-500';
    case 'concept': return 'bg-purple-500';
    case 'action': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}
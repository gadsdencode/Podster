import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Filter, RotateCcw } from "lucide-react";
import { analyzeKeywords, highlightText, type AnalysisResult } from "@/lib/keyword-analyzer";

interface HighlightedTranscriptProps {
  transcript: string;
}

export default function HighlightedTranscript({ transcript }: HighlightedTranscriptProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['important', 'technical', 'name', 'concept', 'action']));

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await analyzeKeywords(transcript);
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
      names: analysis.categories.names.length,
      concepts: analysis.categories.concepts.length,
      actions: analysis.categories.actions.length
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
    names: 'Names',
    concepts: 'Concepts',
    actions: 'Actions'
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg border border-indigo-200/50 dark:border-indigo-700/50">
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          size="sm"
          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {isAnalyzing ? 'Analyzing...' : 'AI Keyword Analysis'}
        </Button>

        {analysis && (
          <>
            <Button
              onClick={() => setShowHighlights(!showHighlights)}
              variant="outline"
              size="sm"
            >
              {showHighlights ? 'Hide' : 'Show'} Highlights
            </Button>

            <Button
              onClick={() => setAnalysis(null)}
              variant="ghost"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Error: {error}
          </p>
        </div>
      )}

      {/* Category Filters */}
      {analysis && (
        <div className="space-y-3 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <h5 className="font-medium text-sm">Filter Categories</h5>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryLabels).map(([key, label]) => {
              const stats = getCategoryStats();
              const count = stats[key as keyof typeof stats] || 0;
              const isSelected = selectedCategories.has(key);
              
              return (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    isSelected 
                      ? categoryColors[key as keyof typeof categoryColors]
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

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
            {Object.entries(categoryLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${categoryColors[key as keyof typeof categoryColors].split(' ')[0]}`} />
                <span>{label}</span>
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
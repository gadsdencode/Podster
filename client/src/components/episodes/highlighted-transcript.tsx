import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Filter, RotateCcw, BookOpen, Lightbulb } from "lucide-react";
import { analyzeKeywords, highlightText, generateDefinitions, type AnalysisResult, type AnalysisProgressCallback } from "@/lib/keyword-analyzer";
import { Progress } from "@/components/ui/progress";
import MiniGlossary from "@/components/ui/mini-glossary";

interface HighlightedTranscriptProps {
  transcript: string;
}

export default function HighlightedTranscript({ transcript }: HighlightedTranscriptProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingDefinitions, setIsGeneratingDefinitions] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
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
      // Use enhanced analysis with automatic definitions and insights
      const result = await analyzeKeywords(transcript, handleProgressUpdate, 30000, {
        includeDefinitions: true,
        includeInsights: true
      });
      setAnalysis(result);
      setShowHighlights(true);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze keywords');
      console.error('Keyword analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateDefinitions = async () => {
    if (!analysis) return;
    
    setIsGeneratingDefinitions(true);
    setError(null);
    setProgressValue(0);
    setProgressStatus('Generating enhanced definitions...');
    
    try {
      // Filter for technical and concept keywords that don't already have definitions
      const keywordsNeedingDefinitions = analysis.keywords.filter(
        k => (k.category === 'technical' || k.category === 'concept') && !k.definition
      );
      
      if (keywordsNeedingDefinitions.length === 0) {
        setProgressStatus('All definitions already generated');
        setProgressValue(100);
        return;
      }
      
      const definitions = await generateDefinitions(
        keywordsNeedingDefinitions, 
        transcript.substring(0, 500), // Provide context
        handleProgressUpdate
      );
      
      // Update keywords with new definitions
      const updatedKeywords = analysis.keywords.map(keyword => {
        if (definitions[keyword.keyword]) {
          return { ...keyword, definition: definitions[keyword.keyword] };
        }
        return keyword;
      });
      
      setAnalysis({
        ...analysis,
        keywords: updatedKeywords
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to generate definitions');
      console.error('Definition generation error:', err);
    } finally {
      setIsGeneratingDefinitions(false);
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

  const getDefinitionStats = () => {
    if (!analysis) return { total: 0, withDefinitions: 0 };
    
    const technicalAndConcept = analysis.keywords.filter(
      k => k.category === 'technical' || k.category === 'concept'
    );
    
    const withDefinitions = technicalAndConcept.filter(k => k.definition);
    
    return {
      total: technicalAndConcept.length,
      withDefinitions: withDefinitions.length
    };
  };

  const categoryColors = {
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
        <div className="flex flex-col sm:flex-row gap-3">
          {!isAnalyzing && !analysis && (
            <Button
              onClick={handleAnalyze}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <Sparkles className="w-4 h-4" />
              Analyze with AI Insights
            </Button>
          )}
          
          {analysis && !isGeneratingDefinitions && getDefinitionStats().total > getDefinitionStats().withDefinitions && (
            <Button
              onClick={handleGenerateDefinitions}
              variant="outline"
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              <Lightbulb className="w-4 h-4" />
              Enhanced Definitions ({getDefinitionStats().withDefinitions}/{getDefinitionStats().total})
            </Button>
          )}
          
          {analysis && getDefinitionStats().withDefinitions > 0 && (
            <Button
              onClick={() => setShowGlossary(true)}
              variant="outline"
              className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20"
            >
              <BookOpen className="w-4 h-4" />
              View Glossary ({getDefinitionStats().withDefinitions})
            </Button>
          )}
          
          {(isAnalyzing || isGeneratingDefinitions) && (
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
                onClick={isGeneratingDefinitions ? handleGenerateDefinitions : handleAnalyze}
                className="h-7 px-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* AI Analysis Status */}
        {analysis && (
          <div className={`text-xs p-3 rounded border ${
            analysis.analysisMetadata?.aiAnalysisSucceeded 
              ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>
                {analysis.analysisMetadata?.aiAnalysisSucceeded ? (
                  <>
                    ✅ AI Analysis Successful: {analysis.keywords.length} keywords identified
                    {getDefinitionStats().withDefinitions > 0 && (
                      <span> • {getDefinitionStats().withDefinitions} with AI definitions</span>
                    )}
                  </>
                ) : (
                  <>
                    ⚠️ AI Analysis Failed: Using {analysis.analysisMetadata?.analysisMethod || 'fallback method'}
                    <span> • {analysis.keywords.length} keywords found via pattern matching</span>
                  </>
                )}
              </span>
            </div>
            {!analysis.analysisMetadata?.aiAnalysisSucceeded && (
              <div className="mt-1 text-xs opacity-75">
                Keywords may not have AI-generated definitions. Check your OpenAI API key or try again.
              </div>
            )}
          </div>
        )}

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
                setShowGlossary(false);
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
          className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed font-mono text-sm bg-gray-50 dark:bg-gray-900/50 p-4 rounded border overflow-auto"
          style={{ lineHeight: '1.7', wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ 
            __html: getHighlightedText()
          }}
        />
      </div>

      {/* Enhanced CSS for keyword highlights with AI insights */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .keyword-highlight {
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 500;
          cursor: help;
          transition: all 0.2s ease;
          display: inline;
          margin: 0 1px;
          white-space: pre-wrap;
          line-height: 1.7;
          position: relative;
          border: 1px solid transparent;
        }
        .keyword-highlight:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          position: relative;
          z-index: 5;
          border-color: rgba(59, 130, 246, 0.5);
        }
        .keyword-highlight[data-has-definition="true"] {
          background-image: linear-gradient(45deg, transparent 0%, rgba(59, 130, 246, 0.1) 100%);
          border-left: 2px solid rgba(59, 130, 246, 0.6);
        }
        .keyword-highlight[data-has-definition="true"]:after {
          content: "💡";
          position: absolute;
          top: -4px;
          right: -4px;
          font-size: 10px;
          opacity: 0.8;
          background: white;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        /* Balanced definition indicator */
        .keyword-highlight[data-definition-type="balanced"]:after {
          content: "⚖️";
        }
        /* Factual definition indicator */
        .keyword-highlight[data-definition-type="factual"]:after {
          content: "📚";
        }
        /* Descriptive definition indicator */
        .keyword-highlight[data-definition-type="descriptive"]:after {
          content: "📝";
        }
        .keyword-highlight[data-category="technical"] {
          border-bottom: 2px dotted rgba(59, 130, 246, 0.6);
        }
        .keyword-highlight[data-category="concept"] {
          border-bottom: 2px dotted rgba(147, 51, 234, 0.6);
        }
        .keyword-highlight[data-confidence="100"]:before {
          content: "⭐";
          position: absolute;
          top: -4px;
          left: -4px;
          font-size: 8px;
          opacity: 0.7;
        }
        /* Special styling for balanced definitions */
        .keyword-highlight[data-definition-type="balanced"] {
          border-left: 2px solid rgba(234, 179, 8, 0.6);
          background-image: linear-gradient(45deg, transparent 0%, rgba(234, 179, 8, 0.1) 100%);
        }
        `
      }} />

      {/* Enhanced Keyword Legend with Definition Types */}
      {analysis && showHighlights && getFilteredKeywords().length > 0 && (
        <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900/20 dark:to-blue-900/20 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Keyword Legend
          </h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs mb-4">
            {['important', 'technical', 'name', 'concept', 'action'].map((category) => (
              <div key={category} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${getCategoryBgClass(category)}`} />
                <span>{getCategoryLabel(category)}</span>
              </div>
            ))}
          </div>
          
          {/* Definition Type Legend */}
          <div className="border-t pt-3 mt-3">
            <h6 className="font-medium text-xs mb-2 text-gray-600 dark:text-gray-400">Definition Types:</h6>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span>📚</span>
                <span>Factual - Objective, technical definitions</span>
              </div>
              <div className="flex items-center gap-2">
                <span>⚖️</span>
                <span>Balanced - Multiple perspectives shown</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📝</span>
                <span>Descriptive - General explanations</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini Glossary Modal */}
      <MiniGlossary
        keywords={analysis?.keywords || []}
        isOpen={showGlossary}
        onClose={() => setShowGlossary(false)}
        title="Episode Glossary"
      />
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
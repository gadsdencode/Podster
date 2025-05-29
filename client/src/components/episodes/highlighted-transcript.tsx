import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Filter, RotateCcw, BookOpen, Lightbulb } from "lucide-react";
import { generateDefinitionsForEpisode, highlightText, type KeywordHighlight, type AnalysisResult, type AnalysisProgressCallback } from "@/lib/keyword-analyzer";
import { Progress } from "@/components/ui/progress";
import MiniGlossary from "@/components/ui/mini-glossary";

interface HighlightedTranscriptProps {
  transcript: string;
  existingKeywords?: any[]; // Keywords from episode data
  existingTopics?: string[]; // Topics from episode data
  episodeId?: number; // Episode ID for optimized definition generation
}

export default function HighlightedTranscript({ 
  transcript, 
  existingKeywords = [], 
  existingTopics = [], 
  episodeId 
}: HighlightedTranscriptProps) {
  const [isGeneratingDefinitions, setIsGeneratingDefinitions] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['important', 'technical', 'name', 'concept', 'action']));
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);

  // Initialize analysis from existing data on component mount
  useEffect(() => {
    if (existingKeywords.length > 0) {
      initializeFromExistingData();
    }
  }, [existingKeywords]);

  const initializeFromExistingData = () => {
    console.log('Initializing from existing keywords:', existingKeywords);
    
    // Convert existing keywords to the expected format
    const keywords: KeywordHighlight[] = existingKeywords.map(kw => ({
      keyword: kw.keyword,
      category: kw.category,
      confidence: kw.confidence || 0.8,
      positions: kw.positions || [],
      definition: kw.definition
    }));

    // Categorize keywords
    const categories = {
      important: keywords.filter(k => k.category === 'important').map(k => k.keyword),
      technical: keywords.filter(k => k.category === 'technical').map(k => k.keyword),
      name: keywords.filter(k => k.category === 'name').map(k => k.keyword),
      concept: keywords.filter(k => k.category === 'concept').map(k => k.keyword),
      action: keywords.filter(k => k.category === 'action').map(k => k.keyword)
    };

    const analysisResult: AnalysisResult = {
      keywords,
      categories,
      analysisMetadata: {
        aiAnalysisSucceeded: true,
        totalKeywords: keywords.length,
        keywordsWithDefinitions: keywords.filter(k => k.definition).length,
        analysisMethod: 'Pre-extracted during upload',
        coverage: 1.0,
        analysisStrategy: 'existing'
      }
    };

    setAnalysis(analysisResult);
    setShowHighlights(true);
  };

  const handleProgressUpdate: AnalysisProgressCallback = (status, progress) => {
    setProgressStatus(status);
    setProgressValue(progress);
  };

  const handleGenerateDefinitions = async () => {
    if (!analysis || !episodeId) return;
    
    setIsGeneratingDefinitions(true);
    setError(null);
    setProgressValue(0);
    setProgressStatus('Generating enhanced definitions...');
    
    try {
      // Filter for technical, concept, and name keywords that don't already have definitions
      const keywordsNeedingDefinitions = analysis.keywords.filter(
        k => (k.category === 'technical' || k.category === 'concept' || k.category === 'name') && !k.definition
      );
      
      if (keywordsNeedingDefinitions.length === 0) {
        setProgressStatus('All definitions already generated');
        setProgressValue(100);
        return;
      }
      
      const result = await generateDefinitionsForEpisode(
        episodeId,
        handleProgressUpdate
      );
      
      // Update analysis with the new keywords that include definitions
      setAnalysis({
        ...analysis,
        keywords: result.keywords,
        analysisMetadata: {
          ...analysis.analysisMetadata!,
          keywordsWithDefinitions: result.keywords.filter(k => k.definition).length
        }
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
    
    const technicalConceptAndNames = analysis.keywords.filter(
      k => k.category === 'technical' || k.category === 'concept' || k.category === 'name'
    );
    
    const withDefinitions = technicalConceptAndNames.filter(k => k.definition);
    
    return {
      total: technicalConceptAndNames.length,
      withDefinitions: withDefinitions.length
    };
  };

  // If no existing keywords, show a message about enabling keyword extraction
  if (existingKeywords.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2 text-sm">
            💡 Keyword Analysis Available
          </h4>
          <p className="text-blue-700 dark:text-blue-300 text-sm mb-3">
            Keywords were not extracted during upload. Enable "Extract Keywords" when uploading episodes to get AI-powered keyword highlighting and definitions.
          </p>
          <p className="text-blue-600 dark:text-blue-400 text-xs">
            This will analyze the transcript during processing and store keywords for instant highlighting.
          </p>
        </div>

        {/* Show topics if available */}
        {existingTopics.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg border border-green-200/50 dark:border-green-700/50">
            <h4 className="font-medium text-green-900 dark:text-green-300 mb-2 flex items-center gap-2 text-sm">
              🏷️ Available Topics
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {existingTopics.map((topic: string, index: number) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 text-xs px-2 py-0.5"
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Plain transcript */}
        <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <h4 className="font-medium text-gray-900 dark:text-gray-200 mb-3 flex items-center gap-2 text-sm">
            📝 Transcript
          </h4>
          <div 
            className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed font-mono text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded border overflow-auto max-h-[60vh]"
            style={{ lineHeight: '1.7', wordBreak: 'break-word' }}
          >
            {transcript}
          </div>
        </div>
      </div>
    );
  }

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
          {!isGeneratingDefinitions && getDefinitionStats().total > getDefinitionStats().withDefinitions && (
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
          
          {(isGeneratingDefinitions) && (
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
                onClick={handleGenerateDefinitions}
                className="h-7 px-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Enhanced AI Analysis Status */}
        {analysis && (
          <div className={`text-xs p-3 rounded border ${
            analysis.analysisMetadata?.aiAnalysisSucceeded 
              ? analysis.analysisMetadata.coverage && analysis.analysisMetadata.coverage >= 0.9
                ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>
                {analysis.analysisMetadata?.aiAnalysisSucceeded ? (
                  <>
                    {analysis.analysisMetadata.coverage && analysis.analysisMetadata.coverage >= 0.9 ? '✅' : '⚠️'} Keywords: {analysis.keywords.length} identified during upload
                    {getDefinitionStats().withDefinitions > 0 && (
                      <span> • {getDefinitionStats().withDefinitions} with AI definitions</span>
                    )}
                    {analysis.analysisMetadata.analysisStrategy === 'existing' && (
                      <span> • Using pre-extracted keywords</span>
                    )}
                  </>
                ) : (
                  <>
                    ❌ Analysis Failed: Using fallback method
                    <span> • {analysis.keywords.length} keywords found</span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        {analysis && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHighlights(!showHighlights)}
                className="h-8 text-xs"
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
                className="h-8 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center">
                <Filter className="w-3 h-3 mr-1 text-gray-500" />
                <span className="text-xs text-gray-500 mr-2">Filter:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['important', 'technical', 'name', 'concept', 'action'].map((category) => {
                  const stats = getCategoryStats();
                  const count = stats[category as keyof typeof stats] || 0;
                  return (
                    <Badge
                      key={category}
                      variant={selectedCategories.has(category) ? "default" : "outline"}
                      className={`cursor-pointer text-xs px-2 py-0.5 ${getCategoryColorClass(category)}`}
                      onClick={() => toggleCategory(category)}
                    >
                      {getCategoryLabel(category)} ({count})
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Filters */}
      {analysis && (
        <div className="flex justify-between items-center mb-2">
          {analysis && getFilteredKeywords().length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Showing {getFilteredKeywords().length} keywords
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
        <div 
          className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed font-mono text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded border overflow-auto max-h-[60vh]"
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
        /* Biographical definition indicator */
        .keyword-highlight[data-definition-type="biographical"]:after {
          content: "👤";
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
        <div className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900/20 dark:to-blue-900/20 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Keyword Legend
          </h5>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs mb-3">
            {['important', 'technical', 'name', 'concept', 'action'].map((category) => (
              <div key={category} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded ${getCategoryBgClass(category)}`} />
                <span className="truncate">{getCategoryLabel(category)}</span>
              </div>
            ))}
          </div>
          
          {/* Definition Type Legend */}
          <div className="border-t pt-2 mt-2">
            <h6 className="font-medium text-xs mb-2 text-gray-600 dark:text-gray-400">Definition Types:</h6>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span>📚</span>
                <span className="truncate">Factual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>⚖️</span>
                <span className="truncate">Balanced</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>📝</span>
                <span className="truncate">Descriptive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>👤</span>
                <span className="truncate">Biographical</span>
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
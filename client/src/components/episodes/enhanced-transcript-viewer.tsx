import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, User, FileText, Search, Download, Copy, 
  Eye, EyeOff, RotateCcw, ChevronUp, ChevronDown,
  BookOpen, Sparkles, Type, AlignLeft
} from "lucide-react";
import type { Episode } from "@/../../shared/schema";

interface EnhancedTranscriptViewerProps {
  episode: Episode | null;
  isOpen: boolean;
  onClose: () => void;
}

interface HighlightedTextProps {
  text: string;
  searchTerm: string;
  className?: string;
}

interface SearchMatch {
  index: number;
  text: string;
  context: string;
}

const HighlightedText = ({ text, searchTerm, className = "" }: HighlightedTextProps) => {
  if (!searchTerm) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <span className={className}>
      {parts.map((part, index) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

const ReadingProgress = ({ scrollProgress }: { scrollProgress: number }) => (
  <div className="fixed top-0 left-0 right-0 z-50">
    <Progress value={scrollProgress} className="h-1 rounded-none" />
  </div>
);

export default function EnhancedTranscriptViewer({ 
  episode, 
  isOpen, 
  onClose 
}: EnhancedTranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormatted, setShowFormatted] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  if (!episode) return null;

  // Determine which transcript to use - properly typed
  const hasFormattedTranscript: boolean = Boolean(
    episode.formattedTranscript && 
    episode.transcriptParagraphs && 
    Array.isArray(episode.transcriptParagraphs) &&
    episode.transcriptParagraphs.length > 0
  );
  
  const displayTranscript = showFormatted && hasFormattedTranscript 
    ? episode.formattedTranscript 
    : episode.transcript;
  const displayParagraphs = showFormatted && hasFormattedTranscript 
    ? episode.transcriptParagraphs as string[]
    : null;

  // Search functionality
  const searchMatches = useMemo((): SearchMatch[] => {
    if (!searchTerm || !displayTranscript) return [];
    
    const regex = new RegExp(searchTerm, 'gi');
    const matches: SearchMatch[] = [];
    let match;
    
    while ((match = regex.exec(displayTranscript)) !== null) {
      matches.push({
        index: match.index,
        text: match[0],
        context: displayTranscript.slice(
          Math.max(0, match.index - 50),
          Math.min(displayTranscript.length, match.index + match[0].length + 50)
        )
      });
    }
    
    return matches;
  }, [searchTerm, displayTranscript]);

  // Handle scroll progress
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target) {
        const scrollTop = target.scrollTop;
        const scrollHeight = target.scrollHeight - target.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        setScrollProgress(progress);
      }
    };

    const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      scrollArea.addEventListener('scroll', handleScroll);
      return () => scrollArea.removeEventListener('scroll', handleScroll);
    }
  }, [isOpen]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = async () => {
    if (displayTranscript) {
      await navigator.clipboard.writeText(displayTranscript);
      // Could add a toast notification here
    }
  };

  const downloadTranscript = () => {
    if (displayTranscript) {
      const blob = new Blob([displayTranscript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${episode.title || 'transcript'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const navigateToMatch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    
    if (direction === 'next') {
      setCurrentMatch((prev) => (prev + 1) % searchMatches.length);
    } else {
      setCurrentMatch((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
    }
  };

  // Helper function to safely get metadata values
  const getMetadataValue = (key: string, defaultValue: string | number = 'N/A'): string => {
    if (!episode.transcriptMetadata || typeof episode.transcriptMetadata !== 'object') {
      return String(defaultValue);
    }
    const metadata = episode.transcriptMetadata as Record<string, any>;
    return String(metadata[key] || defaultValue);
  };

  return (
    <>
      <ReadingProgress scrollProgress={scrollProgress} />
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[95vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/20 flex flex-col p-0">
          <DialogHeader className="border-b border-white/10 pb-4 px-6 pt-6 flex-shrink-0">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Enhanced Transcript Viewer
            </DialogTitle>
            
            {/* Episode Info */}
            <div className="space-y-3 pt-2">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                {episode.title || 'YouTube Video'}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {episode.channel && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{String(episode.channel)}</span>
                  </div>
                )}
                
                {episode.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(Number(episode.duration))}</span>
                  </div>
                )}
                
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {String(episode.extractionMethod)}
                </Badge>
                
                {episode.wordCount && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {Number(episode.wordCount).toLocaleString()} words
                  </span>
                )}

                {hasFormattedTranscript ? (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Formatted
                  </Badge>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          {/* Controls */}
          <div className="border-b border-white/10 px-6 py-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search in transcript..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentMatch(0);
                    }}
                    className="pl-10 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                  />
                </div>
                
                {searchMatches.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{currentMatch + 1} of {searchMatches.length} matches</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToMatch('prev')}
                        disabled={searchMatches.length === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToMatch('next')}
                        disabled={searchMatches.length === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* View Controls */}
              <div className="flex items-center gap-2">
                {hasFormattedTranscript ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowFormatted(!showFormatted)}
                    className="flex items-center gap-2"
                  >
                    {showFormatted ? (
                      <>
                        <Type className="w-4 h-4" />
                        Formatted
                      </>
                    ) : (
                      <>
                        <AlignLeft className="w-4 h-4" />
                        Raw
                      </>
                    )}
                  </Button>
                ) : null}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadTranscript}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            </div>
          </div>

          {/* Transcript Content */}
          <div className="flex-1 px-6 py-4 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {!displayTranscript ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Transcript Available</h3>
                  <p>This episode doesn't have a transcript yet or processing is still in progress.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Formatting Info */}
                  {hasFormattedTranscript && showFormatted && Boolean(episode.transcriptMetadata) && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200/50 dark:border-green-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <h4 className="font-medium text-green-900 dark:text-green-300 text-sm">
                          AI-Enhanced Formatting
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-green-700 dark:text-green-300">
                        <div>
                          <span className="font-medium">Method:</span> {getMetadataValue('formattingMethod', 'AI')}
                        </div>
                        <div>
                          <span className="font-medium">Sentences:</span> {getMetadataValue('sentenceCount', 0)}
                        </div>
                        <div>
                          <span className="font-medium">Paragraphs:</span> {getMetadataValue('paragraphCount', 0)}
                        </div>
                        <div>
                          <span className="font-medium">Confidence:</span> {Math.round(Number(getMetadataValue('confidence', 0.9)) * 100)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transcript Text */}
                  {displayParagraphs ? (
                    // Formatted paragraph display
                    <article className="prose prose-lg prose-gray dark:prose-invert max-w-none">
                      {displayParagraphs.map((paragraph, index) => (
                        <p 
                          key={index}
                          className="mb-6 leading-relaxed text-gray-800 dark:text-gray-200 text-base"
                        >
                          <HighlightedText 
                            text={String(paragraph)} 
                            searchTerm={searchTerm}
                          />
                        </p>
                      ))}
                    </article>
                  ) : (
                    // Raw transcript display
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg border">
                      <div 
                        className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed font-mono text-sm overflow-auto"
                        style={{ lineHeight: '1.7', wordBreak: 'break-word' }}
                      >
                        <HighlightedText 
                          text={String(displayTranscript)} 
                          searchTerm={searchTerm}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Reading Progress: {Math.round(scrollProgress)}%</span>
                {searchMatches.length > 0 && (
                  <span>{searchMatches.length} search matches</span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {hasFormattedTranscript ? (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                    Enhanced with AI
                  </span>
                ) : null}
                <span className="text-xs">
                  {String(displayTranscript || '').length.toLocaleString()} characters
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 
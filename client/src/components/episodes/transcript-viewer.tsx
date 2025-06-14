import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText } from "lucide-react";
import HighlightedTranscript from "./highlighted-transcript";
import type { Episode } from "@/../../shared/schema";
import { ReactNode } from "react";

// Helper function to safely check and convert unknown values to ReactNode
const safeRender = (value: unknown): ReactNode => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
};

interface TranscriptViewerProps {
  episode: Episode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TranscriptViewer({ episode, isOpen, onClose }: TranscriptViewerProps) {
  if (!episode) return null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/20 flex flex-col p-0">
        <DialogHeader className="border-b border-white/10 pb-3 px-6 pt-6 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Transcript Viewer
          </DialogTitle>
          
          {/* Episode Info - Compact Layout */}
          <div className="space-y-2 pt-2">
            <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
              {episode.title || 'YouTube Video'}
            </h3>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              {episode.channel && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{episode.channel}</span>
                </div>
              )}
              
              {episode.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(Number(episode.duration))}</span>
                </div>
              )}
              
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5">
                {episode.extractionMethod}
              </Badge>
              
              {episode.wordCount && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                  {episode.wordCount.toLocaleString()} words
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 pb-6">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 py-4">
              {/* AI Summary */}
              {(() => {
                if (typeof episode.summary === 'string' && episode.summary.trim() !== '') {
                  return (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-3 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                      <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2 text-sm">
                        🤖 AI Summary
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                        {episode.summary}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Topics */}
              {(() => {
                if (episode.topics && Array.isArray(episode.topics) && episode.topics.length > 0) {
                  return (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg border border-green-200/50 dark:border-green-700/50">
                      <h4 className="font-medium text-green-900 dark:text-green-300 mb-2 flex items-center gap-2 text-sm">
                        🏷️ Key Topics
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {episode.topics.map((topic: string, index: number) => (
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
                  );
                }
                return null;
              })()}

              {/* Full Transcript with AI Keyword Highlighting */}
              <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                <h4 className="font-medium text-gray-900 dark:text-gray-200 mb-3 flex items-center gap-2 text-sm">
                  📝 Full Transcript
                </h4>
                
                {(() => {
                  if (typeof episode.transcript === 'string' && episode.transcript) {
                    return (
                      <HighlightedTranscript 
                        transcript={episode.transcript} 
                        existingKeywords={Array.isArray(episode.keywords) ? episode.keywords : []}
                        existingTopics={Array.isArray(episode.topics) ? episode.topics : []}
                        episodeId={episode.id}
                      />
                    );
                  }
                  return (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Transcript not available</p>
                      <p className="text-sm">Processing may still be in progress</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText, MessageSquare, Sparkles, Wand2, Loader2 } from "lucide-react";
import HighlightedTranscript from "./highlighted-transcript";
import type { Episode } from "@/../../shared/schema";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { episodesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TranscriptViewerProps {
  episode: Episode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TranscriptViewer({ episode, isOpen, onClose }: TranscriptViewerProps) {
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [useEnhanced, setUseEnhanced] = useState(true);
  const [enhancing, setEnhancing] = useState(false);
  const { toast } = useToast();
  
  if (!episode) return null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if transcript has multiple speakers (as indicated by triple newlines)
  const hasMultipleSpeakers = episode.transcript && episode.transcript.includes('\n\n\n');
  
  // Safely handle episode.summary which might be unknown type
  const getSummary = (): string => {
    if (!episode.summary) return "";
    if (typeof episode.summary === "string") return episode.summary;
    try {
      return typeof episode.summary === "object" 
        ? JSON.stringify(episode.summary) 
        : String(episode.summary);
    } catch (e) {
      return "";
    }
  };
  
  // Safely get topics array
  const getTopics = (): string[] => {
    if (!episode.topics) return [];
    if (!Array.isArray(episode.topics)) {
      // If it's not an array, try to parse it if it's a string
      try {
        const parsed = typeof episode.topics === "string" 
          ? JSON.parse(episode.topics) 
          : episode.topics;
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    // If it's already an array, map each item to string
    return episode.topics.map((t: unknown) => String(t));
  };

  // Determine which transcript to display based on toggle and availability
  const getActiveTranscript = (): string => {
    // If enhanced is preferred and available, use it
    if (useEnhanced && episode.enhancedTranscript) {
      return episode.enhancedTranscript;
    }
    // Otherwise fall back to original transcript
    return episode.transcript || "";
  };

  // Handle requesting AI enhancement
  const handleEnhanceTranscript = async () => {
    if (!episode || !episode.id || !episode.transcript) return;
    
    try {
      setEnhancing(true);
      const response = await episodesApi.enhance(episode.id);
      
      if (response.ok) {
        toast({
          title: "Enhancement requested",
          description: "The transcript is being enhanced. This may take a minute.",
          duration: 5000,
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to enhance transcript");
      }
    } catch (error: any) {
      toast({
        title: "Enhancement failed",
        description: error.message || "Could not enhance transcript. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setEnhancing(false);
    }
  };

  // Get summary as string
  const summary = getSummary();
  
  // Get topics as string array
  const topics = getTopics();

  // Get active transcript
  const activeTranscript = getActiveTranscript();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/20">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Transcript Viewer
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
                  <span>{episode.channel}</span>
                </div>
              )}
              
              {episode.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(Number(episode.duration))}</span>
                </div>
              )}
              
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {episode.extractionMethod}
              </Badge>
              
              {episode.wordCount && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {episode.wordCount.toLocaleString()} words
                </span>
              )}
              
              {hasMultipleSpeakers && (
                <Badge variant="outline" className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800">
                  <MessageSquare className="w-3 h-3" />
                  <span>Multiple Speakers</span>
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between my-2 flex-wrap gap-2">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnalyzeMode(!analyzeMode)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 border-blue-200 dark:border-blue-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
              >
                {analyzeMode ? "View Plain Transcript" : "Analyze Keywords"}
              </Button>
              
              {episode.hasEnhancedTranscript && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enhanced-mode"
                    checked={useEnhanced}
                    onCheckedChange={setUseEnhanced}
                  />
                  <Label htmlFor="enhanced-mode" className="flex items-center gap-1">
                    <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                    <span>AI Enhanced</span>
                  </Label>
                </div>
              )}
              
              {episode.transcript && !episode.hasEnhancedTranscript && !enhancing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnhanceTranscript}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 border-purple-200 dark:border-purple-700/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/20"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                  Enhance Transcript
                </Button>
              )}
              
              {enhancing && (
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enhancing...</span>
                </div>
              )}
            </div>
          </div>
          
          <ScrollArea className="h-[65vh] pr-4">
            <div className="space-y-6">
              {/* AI Summary */}
              {summary && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    🤖 AI Summary
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}

              {/* Topics */}
              {topics.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200/50 dark:border-green-700/50">
                  <h4 className="font-medium text-green-900 dark:text-green-300 mb-3 flex items-center gap-2">
                    🏷️ Key Topics
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic, index) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Transcript with AI Keyword Highlighting */}
              <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                <h4 className="font-medium text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
                  📝 Full Transcript
                  {useEnhanced && episode.enhancedTranscript && (
                    <Badge variant="outline" className="ml-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800">
                      <Wand2 className="w-3 h-3 mr-1" />
                      AI Enhanced
                    </Badge>
                  )}
                </h4>
                
                {activeTranscript ? (
                  <HighlightedTranscript 
                    transcript={activeTranscript}
                    initialAnalyzeMode={analyzeMode}
                    isEnhanced={useEnhanced && Boolean(episode.enhancedTranscript)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Transcript not available</p>
                    <p className="text-sm">Processing may still be in progress</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
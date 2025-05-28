import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Edit, ExternalLink, X } from "lucide-react";
import type { Episode } from "@shared/schema";

interface TranscriptModalProps {
  episode: Episode | null;
  isOpen: boolean;
  onClose: () => void;
}

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-amber-500/30 text-amber-200 px-1 rounded">
        {part}
      </mark>
    ) : part
  );
};

// Mock transcript segments with timestamps
const generateTranscriptSegments = (transcript: string) => {
  if (!transcript) return [];
  
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());
  return sentences.map((sentence, index) => ({
    timestamp: `${Math.floor(index * 30 / 60)}:${(index * 30 % 60).toString().padStart(2, '0')}`,
    text: sentence.trim(),
  }));
};

export default function TranscriptModal({ episode, isOpen, onClose }: TranscriptModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  if (!episode) return null;

  const transcriptSegments = generateTranscriptSegments(episode.transcript || "");
  
  const filteredSegments = transcriptSegments.filter(segment =>
    !searchQuery || segment.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count total matches
  const totalMatches = searchQuery 
    ? transcriptSegments.reduce((count, segment) => {
        const matches = segment.text.toLowerCase().split(searchQuery.toLowerCase()).length - 1;
        return count + matches;
      }, 0)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] glassmorphism border-white/20">
        {/* Header */}
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{episode.title}</DialogTitle>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <span>{episode.channel}</span>
                <span>•</span>
                <span>{episode.duration}</span>
                <span>•</span>
                <span>{episode.wordCount} words</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <div className="flex items-center space-x-4 py-4 border-b border-white/10">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 border-white/20"
            />
          </div>
          
          <Badge className={
            episode.extractionMethod === "caption" ? "bg-blue-500/20 text-blue-400" :
            episode.extractionMethod === "scraping" ? "bg-purple-500/20 text-purple-400" :
            "bg-emerald-500/20 text-emerald-400"
          }>
            {episode.extractionMethod === "caption" ? "Caption-Based" :
             episode.extractionMethod === "scraping" ? "Web Scraping" :
             "Audio-Based"}
          </Badge>
        </div>

        {/* Transcript Content */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-4">
            {transcriptSegments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Transcript Available</h3>
                <p>This episode doesn't have a transcript yet or processing is still in progress.</p>
              </div>
            ) : (
              <div className="space-y-4 font-mono text-sm leading-relaxed">
                {filteredSegments.map((segment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex space-x-4 hover:bg-white/5 rounded-lg p-3 transition-colors"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 min-w-[60px] h-auto p-1 text-xs"
                    >
                      {segment.timestamp}
                    </Button>
                    <p className="text-slate-300 flex-1">
                      {highlightText(segment.text, searchQuery)}
                    </p>
                  </motion.div>
                ))}
                
                {searchQuery && filteredSegments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No matches found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center space-x-4">
            <Button variant="outline" className="glassmorphism border-white/20">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="glassmorphism border-white/20">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" className="glassmorphism border-white/20">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Video
            </Button>
          </div>
          
          {searchQuery && (
            <div className="text-sm text-muted-foreground">
              {totalMatches} matches found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, RotateCcw } from "lucide-react";
import { useDeleteEpisode } from "@/hooks/use-episodes";
import { useToast } from "@/hooks/use-toast";
import TranscriptViewer from "./transcript-viewer";
import { useState } from "react";
import type { Episode } from "@shared/schema";

interface EpisodeCardProps {
  episode: Episode;
  viewMode: "grid" | "list";
}

export default function EpisodeCard({ episode, viewMode }: EpisodeCardProps) {
  const { toast } = useToast();
  const deleteEpisodeMutation = useDeleteEpisode();
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteEpisodeMutation.mutateAsync(episode.id);
      toast({
        title: "Episode Deleted",
        description: "The episode has been successfully deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete episode",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500";
      case "processing":
        return "bg-amber-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-slate-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "✓ Processed";
      case "processing":
        return "⏳ Processing";
      case "failed":
        return "✗ Failed";
      default:
        return "⏸ Pending";
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "caption":
        return "bg-blue-500/20 text-blue-400";
      case "scraping":
        return "bg-purple-500/20 text-purple-400";
      case "audio":
        return "bg-emerald-500/20 text-emerald-400";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  const getMethodText = (method: string) => {
    switch (method) {
      case "caption":
        return "Caption-Based";
      case "scraping":
        return "Web Scraping";
      case "audio":
        return "Audio-Based";
      default:
        return method;
    }
  };

  if (viewMode === "list") {
    return (
      <>
        <Card className="glassmorphism border-white/10 hover:bg-white/5 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center space-x-6">
              <img 
                src={episode.thumbnailUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=80"} 
                alt={episode.title}
                className="w-20 h-12 object-cover rounded"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm line-clamp-1 mb-1">{episode.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">{episode.channel} • {episode.duration}</p>
                <div className="flex items-center space-x-2">
                  <Badge className={getMethodColor(episode.extractionMethod)}>
                    {getMethodText(episode.extractionMethod)}
                  </Badge>
                  <Badge className={getStatusColor(episode.status)}>
                    {getStatusText(episode.status)}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  {episode.wordCount ? `${episode.wordCount} words` : ""}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsTranscriptOpen(true)}
                  disabled={!episode.transcript}
                  title={episode.transcript ? "View transcript" : "Transcript not available"}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {episode.status === "failed" && (
                  <Button variant="ghost" size="sm">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteEpisodeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <TranscriptViewer 
          episode={episode}
          isOpen={isTranscriptOpen}
          onClose={() => setIsTranscriptOpen(false)}
        />
      </>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="glassmorphism border-white/10 hover:bg-white/5 transition-colors overflow-hidden">
        <div className="relative">
          <img 
            src={episode.thumbnailUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=225"} 
            alt={episode.title}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
            {episode.duration}
          </div>
          <div className={`absolute top-3 left-3 text-white text-xs px-2 py-1 rounded-full ${getStatusColor(episode.status)}`}>
            {getStatusText(episode.status)}
          </div>
        </div>
        
        <CardContent className="p-6">
          <h3 className="font-medium text-sm line-clamp-2 mb-2">{episode.title}</h3>
          <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
            {episode.description || `${episode.channel} • ${new Date(episode.createdAt).toLocaleDateString()}`}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs">
              <Badge className={getMethodColor(episode.extractionMethod)}>
                {getMethodText(episode.extractionMethod)}
              </Badge>
              <span className="text-muted-foreground">
                {episode.wordCount ? `${episode.wordCount} words` : ""}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsTranscriptOpen(true)}
                disabled={!episode.transcript}
                title={episode.transcript ? "View transcript" : "Transcript not available"}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {episode.status === "failed" && (
                <Button variant="ghost" size="sm">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDelete}
                disabled={deleteEpisodeMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <TranscriptViewer 
        episode={episode}
        isOpen={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
      />
    </motion.div>
  );
}

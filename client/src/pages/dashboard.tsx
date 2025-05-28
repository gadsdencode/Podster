import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Play, Clock, CheckCircle, Database, Plus, ArrowRight, Eye, RefreshCw } from "lucide-react";
import { useSystemStats } from "@/hooks/use-episodes";
import { useRecentEpisodes } from "@/hooks/use-episodes";
import TranscriptViewer from "@/components/episodes/transcript-viewer";
import { useState, useEffect } from "react";
import type { Episode } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { StatsCardGrid } from "@/components/ui/stats-card-grid";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useSystemStats();
  const { data: recentEpisodes, isLoading: episodesLoading, refetch: refetchEpisodes } = useRecentEpisodes();
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Debug: Log stats when they change
  useEffect(() => {
    if (stats) {
      console.log('Dashboard received stats:', stats);
    }
  }, [stats]);
  
  // Set up auto-refresh every 5 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData(false);
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleViewTranscript = (episode: Episode) => {
    setSelectedEpisode(episode);
    setIsTranscriptOpen(true);
  };
  
  const refreshData = async (showRefreshState = true) => {
    if (showRefreshState) {
      setRefreshing(true);
    }
    
    try {
      // Invalidate and refetch all necessary queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/episodes"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/episodes", "recent"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] }),
        refetchEpisodes()
      ]);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
    
    if (showRefreshState) {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
          Extract YouTube Transcripts
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Advanced AI-powered transcript extraction with multiple methods. Fast, reliable, and always works.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/add-episode">
            <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
              <Plus className="mr-2 h-5 w-5" />
              Start Extracting
            </Button>
          </Link>
          <Button 
            size="icon" 
            variant="outline" 
            onClick={() => refreshData()}
            disabled={refreshing}
            title="Refresh data"
            className={refreshing ? "animate-spin" : ""}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </motion.section>

      {/* Stats Cards */}
      <StatsCardGrid stats={stats} statsLoading={statsLoading} />

      {/* Recent Episodes */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent Episodes</h2>
          <Link href="/episodes">
            <Button variant="outline" className="glassmorphism border-white/20">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {episodesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="glassmorphism border-white/10 animate-pulse">
                <div className="h-32 bg-muted rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : recentEpisodes?.length === 0 ? (
            <Card className="glassmorphism border-white/10 col-span-full">
              <CardContent className="p-12 text-center">
                <div className="text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Episodes Yet</h3>
                  <p className="mb-4">Start by adding your first YouTube video to extract transcripts.</p>
                  <Link href="/add-episode">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Episode
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            recentEpisodes?.slice(0, 6).map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="glassmorphism border-white/10 hover:bg-white/5 transition-colors">
                  <div className="relative">
                    <img 
                      src={episode.thumbnailUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=225"} 
                      alt={episode.title}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
                      {episode.duration}
                    </div>
                    <div className={`absolute top-2 left-2 text-white text-xs px-2 py-1 rounded-full ${
                      episode.status === "completed" ? "bg-emerald-500" :
                      episode.status === "processing" ? "bg-amber-500" :
                      episode.status === "failed" ? "bg-red-500" :
                      "bg-slate-500"
                    }`}>
                      {episode.status === "completed" ? "✓ Processed" :
                       episode.status === "processing" ? "⏳ Processing" :
                       episode.status === "failed" ? "✗ Failed" :
                       "⏸ Pending"}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-sm line-clamp-2 mb-2">{episode.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{episode.channel}</p>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className={`px-2 py-1 rounded ${
                        episode.extractionMethod === "caption" ? "bg-blue-500/20 text-blue-400" :
                        episode.extractionMethod === "scraping" ? "bg-purple-500/20 text-purple-400" :
                        "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {episode.extractionMethod === "caption" ? "Caption-Based" :
                         episode.extractionMethod === "scraping" ? "Web Scraping" :
                         "Audio-Based"}
                      </span>
                      <span className="text-muted-foreground">
                        {episode.wordCount ? `${episode.wordCount} words` : ""}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewTranscript(episode)}
                        disabled={!episode.transcript}
                        title={episode.transcript ? "View transcript" : "Transcript not available"}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </motion.section>

      {/* Transcript Viewer Modal */}
      {selectedEpisode && (
        <TranscriptViewer 
          episode={selectedEpisode}
          isOpen={isTranscriptOpen}
          onClose={() => setIsTranscriptOpen(false)}
        />
      )}
    </div>
  );
}

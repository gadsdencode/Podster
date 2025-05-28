import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCreateEpisode } from "@/hooks/use-episodes";
import ExtractionMethodSelector from "@/components/episodes/extraction-method-selector";
import SimpleProcessingIndicator from "@/components/episodes/simple-processing-indicator";
import { Link, Video, Zap, Layers } from "lucide-react";
import type { ExtractionMethod } from "@/types";

export default function AddEpisode() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>("scraping");
  const [generateSummary, setGenerateSummary] = useState(false);
  const [extractTopics, setExtractTopics] = useState(false);
  const [processingEpisodeId, setProcessingEpisodeId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const createEpisodeMutation = useCreateEpisode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!youtubeUrl) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    try {
      const episode = await createEpisodeMutation.mutateAsync({
        youtubeUrl,
        extractionMethod,
        generateSummary,
        extractTopics,
        userId: 1 // Default user
      });

      setProcessingEpisodeId(episode.id);
      setYoutubeUrl("");
      
      toast({
        title: "Episode Added",
        description: "Your episode has been added to the processing queue.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add episode",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl font-bold">Add New Episode</h1>
        <p className="text-muted-foreground">
          Extract transcripts from YouTube videos using multiple methods
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          <Card className="glassmorphism border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Link className="mr-2 h-5 w-5 text-primary" />
                YouTube URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="url">Video URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="bg-background/50 border-white/20"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the YouTube video URL to extract transcript
                  </p>
                </div>

                <ExtractionMethodSelector
                  value={extractionMethod}
                  onChange={setExtractionMethod}
                />

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Advanced Options</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="summary"
                        checked={generateSummary}
                        onCheckedChange={setGenerateSummary}
                      />
                      <Label htmlFor="summary" className="text-sm">
                        Generate AI summary
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="topics"
                        checked={extractTopics}
                        onCheckedChange={setExtractTopics}
                      />
                      <Label htmlFor="topics" className="text-sm">
                        Extract key topics
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="submit"
                    disabled={createEpisodeMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    {createEpisodeMutation.isPending ? "Adding..." : "Start Extraction"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="glassmorphism border-white/20"
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Batch Process
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {processingEpisodeId && (
            <SimpleProcessingIndicator 
              episodeId={processingEpisodeId}
              onClose={() => setProcessingEpisodeId(null)}
            />
          )}

          {/* Quick Stats */}
          <Card className="glassmorphism border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Zap className="mr-2 h-5 w-5 text-primary" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Queue Position</span>
                <span className="font-mono">#1</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated Time</span>
                <span className="font-mono">30s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className="font-mono text-emerald-400">98.7%</span>
              </div>
            </CardContent>
          </Card>

          {/* Method Comparison */}
          <Card className="glassmorphism border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Method Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Caption-Based</span>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">~30s</span>
                </div>
                <div className="w-full bg-background/30 rounded-full h-1">
                  <div className="bg-blue-500 h-1 rounded-full w-1/4"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Web Scraping</span>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">~1-2min</span>
                </div>
                <div className="w-full bg-background/30 rounded-full h-1">
                  <div className="bg-purple-500 h-1 rounded-full w-1/2"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Audio-Based</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">~2-5min</span>
                </div>
                <div className="w-full bg-background/30 rounded-full h-1">
                  <div className="bg-emerald-500 h-1 rounded-full w-full"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

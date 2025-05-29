import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wand2, FileText, RefreshCw } from "lucide-react";
import { useEpisodes } from "@/hooks/use-episodes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { episodesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Episode } from "@/../../shared/schema";
import { Progress } from "@/components/ui/progress";

// Type for enhancement status
interface EnhancementStatus {
  episodeId: number;
  status: string;
  progress: number;
  currentStep: string;
  hasEnhancedTranscript: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  isFailed: boolean;
}

export default function EpisodeManagement() {
  const { data: episodes, isLoading, refetch } = useEpisodes();
  const [enhancing, setEnhancing] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [enhancementStatuses, setEnhancementStatuses] = useState<Record<number, EnhancementStatus>>({});
  const { toast } = useToast();

  // Function to handle enhancing a transcript
  const handleEnhanceTranscript = async (episodeId: number) => {
    if (!episodeId) return;
    
    try {
      setEnhancing(true);
      setSelectedEpisodeId(episodeId);
      
      const response = await episodesApi.enhance(episodeId);
      
      if (response.ok) {
        // Start polling for status updates
        checkEnhancementStatus(episodeId);
        
        toast({
          title: "Enhancement started",
          description: "The transcript is being enhanced. You can monitor progress here.",
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
      setEnhancing(false);
      setSelectedEpisodeId(null);
    }
  };
  
  // Function to check enhancement status
  const checkEnhancementStatus = async (episodeId: number) => {
    try {
      const status = await episodesApi.getEnhancementStatus(episodeId);
      
      // Update the status in our state
      setEnhancementStatuses(prev => ({
        ...prev,
        [episodeId]: status
      }));
      
      // If still processing, poll again after a delay
      if (status.isProcessing) {
        setTimeout(() => checkEnhancementStatus(episodeId), 2000);
      } else {
        // Processing completed or failed
        setEnhancing(false);
        setSelectedEpisodeId(null);
        
        if (status.isCompleted) {
          toast({
            title: "Enhancement completed",
            description: "The transcript has been successfully enhanced.",
            duration: 5000,
          });
          // Refresh episode data
          refetch();
        } else if (status.isFailed) {
          toast({
            title: "Enhancement failed",
            description: status.currentStep || "An error occurred during enhancement.",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error("Error checking enhancement status:", error);
      // Stop polling on error
      setEnhancing(false);
      setSelectedEpisodeId(null);
    }
  };
  
  // Function to check initial status of processing episodes on component mount
  useEffect(() => {
    if (!episodes) return;
    
    // Check for any episodes that are currently being processed
    const processingEpisodes = episodes.filter(ep => 
      ep.status === "processing" && ep.currentStep?.includes("Enhancing")
    );
    
    // Start polling for these episodes
    processingEpisodes.forEach(episode => {
      checkEnhancementStatus(episode.id);
    });
  }, [episodes]);
  
  // Function to open the transcript viewer
  const openTranscriptViewer = (episode: Episode) => {
    setSelectedEpisode(episode);
    setIsViewerOpen(true);
  };

  // Function to render enhancement status
  const renderEnhancementStatus = (episode: Episode) => {
    const status = enhancementStatuses[episode.id];
    
    if (!status) {
      return null;
    }
    
    if (status.isProcessing) {
      return (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs mb-1">
            <span>{status.currentStep || "Processing..."}</span>
            <span>{status.progress}%</span>
          </div>
          <Progress value={status.progress} className="h-1.5" />
        </div>
      );
    }
    
    return null;
  };

  return (
    <>
      <Card className="glassmorphism border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Episode Management
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Enhanced</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {episodes?.map((episode) => (
                    <TableRow key={episode.id}>
                      <TableCell className="font-medium">{episode.title || "Untitled"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            episode.status === "completed" ? "default" : 
                            episode.status === "processing" ? "secondary" : 
                            episode.status === "failed" ? "destructive" : 
                            "outline"
                          }
                        >
                          {episode.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{episode.extractionMethod}</TableCell>
                      <TableCell>
                        {episode.hasEnhancedTranscript ? (
                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            Enhanced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
                            Standard
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openTranscriptViewer(episode)}
                          >
                            View
                          </Button>
                          
                          {episode.status === "completed" && episode.transcript && !episode.hasEnhancedTranscript && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/20"
                              onClick={() => handleEnhanceTranscript(episode.id)}
                              disabled={enhancing && selectedEpisodeId === episode.id}
                            >
                              {enhancing && selectedEpisodeId === episode.id ? (
                                <>Enhancing<span className="ml-1 animate-pulse">...</span></>
                              ) : (
                                <>
                                  <Wand2 className="w-3.5 h-3.5 mr-1" />
                                  Enhance
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {/* Enhancement Progress */}
                        {renderEnhancementStatus(episode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Simple Transcript Viewer Dialog */}
      <Dialog open={isViewerOpen} onOpenChange={(open) => {
        setIsViewerOpen(open);
        if (!open) setSelectedEpisode(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedEpisode?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4">
              {selectedEpisode?.hasEnhancedTranscript && (
                <div>
                  <h3 className="text-md font-semibold flex items-center mb-2">
                    <Wand2 className="w-4 h-4 mr-2 text-purple-500" />
                    Enhanced Transcript
                  </h3>
                  <div className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md">
                    {selectedEpisode.enhancedTranscript}
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="text-md font-semibold mb-2">Original Transcript</h3>
                <div className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md">
                  {selectedEpisode?.transcript || "No transcript available"}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
} 
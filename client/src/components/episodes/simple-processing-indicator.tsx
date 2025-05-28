import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SimpleProcessingIndicatorProps {
  episodeId: number;
  onClose?: () => void;
}

export default function SimpleProcessingIndicator({ episodeId, onClose }: SimpleProcessingIndicatorProps) {
  const { data: episode } = useQuery({
    queryKey: ["/api/episodes", episodeId],
    queryFn: () => fetch(`/api/episodes/${episodeId}`).then(res => res.json()),
    refetchInterval: 1000,
    enabled: !!episodeId,
  });
  
  const [dots, setDots] = useState("");

  // Animated dots for processing
  useEffect(() => {
    if (episode?.status === "processing") {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? "" : prev + ".");
      }, 500);
      return () => clearInterval(interval);
    }
  }, [episode?.status]);

  // Auto-close on completion
  useEffect(() => {
    if (episode?.status === "completed" && onClose) {
      setTimeout(onClose, 2000);
    }
  }, [episode?.status, onClose]);

  if (!episode) {
    return (
      <Card className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading episode...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (episode.status === "processing") {
    return (
      <Card className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <h3 className="font-medium text-sm">Processing Episode</h3>
                <p className="text-xs text-muted-foreground">Extracting transcript{dots}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Method: {episode.extractionMethod === "caption" ? "Caption-Based" :
                           episode.extractionMethod === "scraping" ? "Web Scraping" :
                           "Audio-Based"}
                </p>
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (episode.status === "completed") {
    return (
      <Card className="bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <h3 className="font-medium text-sm">Processing Complete</h3>
                <p className="text-xs text-muted-foreground">
                  Successfully extracted {episode.transcript?.length || 0} characters
                </p>
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (episode.status === "failed") {
    return (
      <Card className="bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <h3 className="font-medium text-sm">Processing Failed</h3>
                <p className="text-xs text-muted-foreground">
                  {episode.errorMessage || "Failed to extract transcript"}
                </p>
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
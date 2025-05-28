import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useEpisode } from "@/hooks/use-episodes";

interface SimpleProcessingIndicatorProps {
  episodeId: number;
  onClose?: () => void;
}

export default function SimpleProcessingIndicator({ episodeId, onClose }: SimpleProcessingIndicatorProps) {
  const { data: episode, isLoading } = useEpisode(episodeId);
  const [dots, setDots] = useState("");

  // Simple dot animation
  useEffect(() => {
    if (episode?.status === "processing") {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? "" : prev + ".");
      }, 500);
      return () => clearInterval(interval);
    }
  }, [episode?.status]);

  useEffect(() => {
    if (episode?.status === "completed" && onClose) {
      setTimeout(onClose, 2000);
    }
  }, [episode?.status, onClose]);

  if (isLoading || !episode) {
    return null;
  }

  const getContent = () => {
    switch (episode.status) {
      case "processing":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
          title: "Processing Episode",
          message: `Extracting transcript${dots}`,
          bgColor: "bg-blue-50 dark:bg-blue-950",
          borderColor: "border-blue-200 dark:border-blue-800"
        };
      
      case "completed":
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          title: "Processing Complete",
          message: `Successfully extracted ${episode.transcript?.length || 0} characters`,
          bgColor: "bg-green-50 dark:bg-green-950",
          borderColor: "border-green-200 dark:border-green-800"
        };
      
      case "failed":
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          title: "Processing Failed",
          message: episode.errorMessage || "Failed to extract transcript",
          bgColor: "bg-red-50 dark:bg-red-950",
          borderColor: "border-red-200 dark:border-red-800"
        };
      
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <Card className={`${content.bgColor} border-2 ${content.borderColor} shadow-lg`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {content.icon}
            <div>
              <h3 className="font-medium text-sm">{content.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{content.message}</p>
              {episode.status === "processing" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Method: {episode.extractionMethod === "caption" ? "Caption-Based" :
                           episode.extractionMethod === "scraping" ? "Web Scraping" :
                           "Audio-Based"}
                </p>
              )}
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
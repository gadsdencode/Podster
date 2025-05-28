import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProcessingStatus } from "@/hooks/use-episodes";
import { Activity, X, CheckCircle, AlertCircle } from "lucide-react";

interface ProcessingStatusProps {
  episodeId: number;
  onComplete?: () => void;
}

export default function ProcessingStatus({ episodeId, onComplete }: ProcessingStatusProps) {
  const { data: status, isLoading } = useProcessingStatus(episodeId);

  useEffect(() => {
    if (status?.status === "completed" && onComplete) {
      setTimeout(onComplete, 2000); // Show completion for 2 seconds
    }
  }, [status?.status, onComplete]);

  if (isLoading || !status) {
    return null;
  }

  const getStatusInfo = () => {
    switch (status.status) {
      case "processing":
        return {
          icon: Activity,
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/30"
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30"
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30"
        };
      default:
        return {
          icon: Activity,
          color: "text-slate-400",
          bgColor: "bg-slate-500/10",
          borderColor: "border-slate-500/30"
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className={`glassmorphism border-2 ${statusInfo.borderColor} ${statusInfo.bgColor}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <statusInfo.icon className={`mr-2 h-5 w-5 ${statusInfo.color} ${
                status.status === "processing" ? "animate-pulse" : ""
              }`} />
              {status.status === "processing" ? "Processing Episode" :
               status.status === "completed" ? "Processing Complete" :
               status.status === "failed" ? "Processing Failed" :
               "Processing Episode"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onComplete}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {status.currentStep || "Preparing to process..."}
              </span>
              <span className={statusInfo.color}>
                {status.progress || 0}%
              </span>
            </div>
            
            {status.status !== "failed" && (
              <Progress 
                value={status.progress || 0} 
                className="h-2"
              />
            )}
          </div>

          {status.status === "processing" && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Method: {status.extractionMethod === "caption" ? "Caption-Based" :
                        status.extractionMethod === "scraping" ? "Web Scraping" :
                        "Audio-Based"}
              </span>
              <span>
                ETA: {status.estimatedTime || "Calculating..."}
              </span>
            </div>
          )}

          {status.status === "completed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-400">✓ Transcript extracted</span>
                <span className="text-muted-foreground">{status.wordCount} words</span>
              </div>
              {status.summary && (
                <div className="text-sm text-emerald-400">✓ Summary generated</div>
              )}
              {status.topics && status.topics.length > 0 && (
                <div className="text-sm text-emerald-400">✓ Topics extracted</div>
              )}
            </div>
          )}

          {status.status === "processing" && (
            <div className="space-y-2">
              <div className="flex items-center space-x-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${(status.progress || 0) >= 10 ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                <span className={(status.progress || 0) >= 10 ? "text-emerald-400" : "text-muted-foreground"}>
                  Initialization complete
                </span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${(status.progress || 0) >= 30 ? 'bg-emerald-500' : (status.progress || 0) >= 10 ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <span className={(status.progress || 0) >= 60 ? "text-emerald-400" : (status.progress || 0) >= 30 ? "text-blue-400" : "text-muted-foreground"}>
                  Transcript extraction
                </span>
              </div>
              {(status.generateSummary || status.extractTopics) && (
                <div className="flex items-center space-x-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${(status.progress || 0) >= 85 ? 'bg-emerald-500' : (status.progress || 0) >= 70 ? 'bg-purple-500 animate-pulse' : 'bg-slate-600'}`}></div>
                  <span className={(status.progress || 0) >= 85 ? "text-emerald-400" : (status.progress || 0) >= 70 ? "text-purple-400" : "text-muted-foreground"}>
                    AI processing
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${(status.progress || 0) >= 100 ? 'bg-emerald-500' : (status.progress || 0) >= 95 ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <span className={(status.progress || 0) >= 100 ? "text-emerald-400" : (status.progress || 0) >= 95 ? "text-amber-400" : "text-muted-foreground"}>
                  Finalizing
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProcessingStatus } from "@/hooks/use-episodes";
import { Activity, X, CheckCircle, AlertCircle, Clock, FileText, Brain, Zap } from "lucide-react";
import { ReactNode } from "react";

// Helper function to safely check and convert unknown values to ReactNode
const safeRender = (value: unknown): ReactNode => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
};

interface ProcessingStatusProps {
  episodeId: number;
  onComplete?: () => void;
}

export default function ProcessingStatus({ episodeId, onComplete }: ProcessingStatusProps) {
  const { data: status, isLoading } = useProcessingStatus(episodeId);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if (status?.status === "processing" && !startTime) {
      setStartTime(new Date());
    }
  }, [status?.status, startTime]);

  useEffect(() => {
    if (status?.status === "processing" && startTime) {
      const timer = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status?.status, startTime]);

  useEffect(() => {
    if (status?.status === "completed" && onComplete) {
      setTimeout(onComplete, 3000);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = (step: string) => {
    if (step?.includes("transcript") || step?.includes("Extracting")) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    if (step?.includes("summary") || step?.includes("AI")) {
      return <Brain className="h-4 w-4 text-purple-500" />;
    }
    if (step?.includes("Initializing")) {
      return <Zap className="h-4 w-4 text-green-500" />;
    }
    return <Activity className="h-4 w-4 text-gray-500 animate-spin" />;
  };

  const statusInfo = getStatusInfo();
  const progress = Math.max(0, Math.min(100, status.progress || 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`glassmorphism border-2 ${statusInfo.borderColor} ${statusInfo.bgColor} shadow-lg`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <statusInfo.icon className={`h-6 w-6 ${statusInfo.color} ${
                status.status === "processing" ? "animate-pulse" : ""
              }`} />
              <div>
                <CardTitle className="text-lg">
                  {status.status === "processing" ? "Processing Episode" :
                   status.status === "completed" ? "Processing Complete" :
                   status.status === "failed" ? "Processing Failed" :
                   "Processing Episode"}
                </CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">
                  {status.extractionMethod === "caption" ? "Caption-Based" :
                   status.extractionMethod === "scraping" ? "Web Scraping" :
                   status.extractionMethod === "audio" ? "Audio-Based" :
                   "Processing"}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onComplete}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5">
          {/* Progress Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {getStepIcon(status.currentStep || "")}
              <span className="text-sm font-medium flex-1">
                {status.currentStep || "Preparing to process..."}
              </span>
              <span className={`text-lg font-bold ${statusInfo.color}`}>
                {progress}%
              </span>
            </div>
            
            {status.status !== "failed" && (
              <div className="relative">
                <Progress value={progress} className="h-3" />
                <motion.div 
                  className={`absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r ${
                    progress < 30 ? "from-blue-500 to-blue-600" :
                    progress < 70 ? "from-yellow-500 to-orange-500" :
                    "from-green-500 to-emerald-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </div>

          {/* Timing Information */}
          {status.status === "processing" && timeElapsed > 0 && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-muted-foreground">Elapsed</div>
                  <div className="font-mono font-medium">{formatTime(timeElapsed)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-muted-foreground">Method</div>
                  <div className="font-medium">
                    {status.extractionMethod === "caption" ? "Caption-Based" :
                     status.extractionMethod === "scraping" ? "Web Scraping" :
                     "Audio-Based"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Information */}
          {status.transcript && (
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Content extracted:</span>
                <span className="font-medium">{status.transcript.length.toLocaleString()} characters</span>
              </div>
              {status.wordCount && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Word count:</span>
                  <span className="font-medium">{status.wordCount.toLocaleString()} words</span>
                </div>
              )}
            </div>
          )}

          {/* Completion Status */}
          {status.status === "completed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-400">✓ Transcript extracted</span>
                <span className="text-muted-foreground">{status.wordCount} words</span>
              </div>
              {status.summary && typeof status.summary === 'string' && (
                <div className="text-sm text-emerald-400">✓ Summary generated</div>
              )}
              {Array.isArray(status.topics) && status.topics.length > 0 && (
                <div className="text-sm text-emerald-400">✓ Topics extracted</div>
              )}
            </div>
          )}

          {/* Error Display */}
          {status.status === "failed" && status.errorMessage && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="font-medium text-red-700 dark:text-red-300">Processing Failed</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">
                {status.errorMessage}
              </p>
            </div>
          )}

          {/* Real-time Processing Indicator */}
          {status.status === "processing" && (
            <div className="flex items-center justify-center pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Processing in real-time...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
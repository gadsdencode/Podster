import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Play, CheckCircle, Clock, Database, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger,
  TooltipPortal 
} from "./tooltip";
import { cn } from "@/lib/utils";

interface StatsData {
  totalEpisodes?: number;
  successRate?: number;
  averageProcessingTime?: string;
  totalStorage?: string;
  // Add trend indicators (optional)
  trends?: {
    totalEpisodes?: number;
    successRate?: number;
    processingTime?: number;
    storage?: number;
  };
}

interface StatsCardGridProps {
  stats?: StatsData;
  statsLoading: boolean;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  loading: boolean;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
  trend?: number;
}

function StatCard({ title, value, loading, icon, color, tooltip, trend }: StatCardProps) {
  // Determine trend icon and color
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };
  
  // Determine trend text
  const getTrendText = () => {
    if (trend === undefined) return "";
    if (trend > 0) return `+${trend}%`;
    if (trend < 0) return `${trend}%`;
    return "0%";
  };
  
  return (
    <Card className="glassmorphism border-white/10 overflow-hidden relative group hover:bg-white/5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
      {/* Background pulse animation during loading */}
      {loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse-slow" />
      )}
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <CardTitle className="text-sm font-medium text-muted-foreground cursor-help group-hover:text-white transition-colors">{title}</CardTitle>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent 
                side="top"
                align="center"
                sideOffset={8} 
                className="z-[100] max-w-xs w-fit p-3 bg-black/90 backdrop-blur-sm border border-white/10 text-white shadow-lg rounded-lg"
                avoidCollisions
                collisionPadding={20}
              >
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </TooltipProvider>
        <div className="transition-transform group-hover:scale-110">
          {icon}
        </div>
      </CardHeader>
      
      <CardContent className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={`stat-${loading ? 'loading' : value}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={cn("text-2xl font-bold", color)}
          >
            {loading ? "..." : value}
          </motion.div>
        </AnimatePresence>
        
        {/* Trend indicator */}
        {!loading && trend !== undefined && (
          <div className="absolute bottom-1 right-1 text-xs flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {getTrendIcon()}
            <span className={cn(
              trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-gray-400"
            )}>
              {getTrendText()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsCardGrid({ stats, statsLoading, className }: StatsCardGridProps) {
  const formatSuccessRate = (rate?: number) => {
    if (rate === undefined) return "100%";
    return `${Math.round(rate)}%`;
  };
  
  const formatStorageValue = (storage?: string) => {
    if (!storage) return "0 GB";
    return storage;
  };
  
  // Add a title and description to the stats section
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("space-y-4", className)}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Performance</h2>
        {statsLoading && (
          <p className="text-sm text-muted-foreground animate-pulse">Refreshing stats...</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Episodes"
          value={stats?.totalEpisodes || 0}
          loading={statsLoading}
          icon={<Play className="h-4 w-4 text-primary" />}
          color="text-primary"
          tooltip="Total number of episodes processed by the system"
          trend={stats?.trends?.totalEpisodes}
        />

        <StatCard
          title="Avg Processing Time"
          value={stats?.averageProcessingTime || "0min"}
          loading={statsLoading}
          icon={<Clock className="h-4 w-4 text-purple-400" />}
          color="text-purple-400"
          tooltip="Average time to process an episode"
          trend={stats?.trends?.processingTime}
        />

        <StatCard
          title="Storage Used"
          value={formatStorageValue(stats?.totalStorage)}
          loading={statsLoading}
          icon={<Database className="h-4 w-4 text-amber-400" />}
          color="text-amber-400"
          tooltip="Total storage space used by episodes"
          trend={stats?.trends?.storage}
        />
      </div>
    </motion.section>
  );
} 
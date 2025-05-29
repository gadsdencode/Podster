import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Play, CheckCircle, Clock, Database, TrendingUp, TrendingDown, Minus, Info, RefreshCw, Maximize2, FileText } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger,
  TooltipPortal 
} from "./tooltip";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Button } from "./button";
import { Badge } from "./badge";
import { formatRelativeTime } from "@/lib/utils";

interface StatsData {
  totalEpisodes?: number;
  successRate?: number;
  averageProcessingTime?: string;
  totalWordCount?: string;
  // Historical data for sparklines
  history?: {
    totalEpisodes?: number[];
    successRate?: number[];
    processingTime?: number[];
    wordCount?: number[];
  };
  // Add trend indicators (optional)
  trends?: {
    totalEpisodes?: number;
    successRate?: number;
    processingTime?: number;
    wordCount?: number;
  };
  lastUpdated?: string;
}

interface StatsCardGridProps {
  stats?: StatsData;
  statsLoading: boolean;
  className?: string;
  onRefresh?: () => void;
  colorScheme?: 'default' | 'vibrant' | 'minimal';
}

interface StatCardProps {
  title: string;
  value: string | number;
  loading: boolean;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
  trend?: number;
  historyData?: number[];
  onClick?: () => void;
  expanded?: boolean;
  accentColor?: string;
}

// TextIcon component (for word count)
const TextIcon = FileText;

// Simple sparkline chart component
function SparkLine({ data, color = "rgba(255,255,255,0.5)", height = 20, className }: { data?: number[], color?: string, height?: number, className?: string }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={cn("w-full overflow-visible", className)} 
      height={height} 
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Add a highlight for the last point */}
      <circle 
        cx={(data.length - 1) / (data.length - 1) * 100} 
        cy={100 - ((data[data.length - 1] - min) / range) * 100} 
        r="2" 
        fill={color}
      />
    </svg>
  );
}

// Animated counter for numbers
function AnimatedCounter({ value, color }: { value: number, color: string }) {
  const springValue = useSpring(0, { stiffness: 100, damping: 30 });
  
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);
  
  return (
    <motion.span className={color}>
      {useTransform(springValue, Math.round)}
    </motion.span>
  );
}

function StatCard({ 
  title, 
  value, 
  loading, 
  icon, 
  color, 
  tooltip, 
  trend, 
  historyData, 
  onClick,
  expanded,
  accentColor = "rgba(255,255,255,0.2)" 
}: StatCardProps) {
  // Determine trend icon and color
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };
  
  // Determine trend text and add "since last period" context
  const getTrendText = () => {
    if (trend === undefined) return "";
    if (trend > 0) return `+${trend}% since last period`;
    if (trend < 0) return `${trend}% since last period`;
    return "No change since last period";
  };

  // Handle mouse interaction for card tilt effect
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (loading) return;
    
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    
    // Calculate the center of the card
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate the mouse position relative to the center
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    // Calculate the rotation values with a sensitivity factor
    const sensitivity = 0.01;
    rotateX.set(-mouseY * sensitivity);
    rotateY.set(mouseX * sensitivity);
  };

  const handleMouseLeave = () => {
    // Animate back to the initial position
    rotateX.set(0);
    rotateY.set(0);
  };

  // Skeleton loading state variants
  const skeletonVariants = {
    loading: {
      opacity: [0.3, 0.6, 0.3],
      transition: {
        repeat: Infinity,
        duration: 1.5
      }
    },
    loaded: {
      opacity: 1
    }
  };
  
  return (
    <motion.div
      onClick={onClick}
      style={{ 
        rotateX, 
        rotateY, 
        transformStyle: "preserve-3d",
        perspective: 1000
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "cursor-pointer transition-all duration-200",
        onClick && "cursor-pointer"
      )}
    >
      <Card className={cn(
        "glassmorphism border-white/10 overflow-hidden relative group hover:bg-white/5 transition-all duration-200 hover:shadow-lg",
        "h-full"
      )}>
        {/* Pulse gradient overlay during loading */}
        {loading && (
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" 
            animate={{
              x: ["0%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear"
            }}
          />
        )}
        
        {/* Accent color top border */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 transform origin-left transition-all duration-300 group-hover:scale-x-100"
          style={{ backgroundColor: accentColor }}
        />
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium text-muted-foreground cursor-help group-hover:text-white transition-colors flex items-center gap-1.5">
                  {title}
                  <Info className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                </CardTitle>
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
                  {trend !== undefined && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {getTrendText()}
                    </Badge>
                  )}
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          </TooltipProvider>
          <div className="transition-transform group-hover:scale-110 group-hover:rotate-12">
            {icon}
          </div>
        </CardHeader>
        
        <CardContent className="relative">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                variants={skeletonVariants}
                initial="loaded"
                animate="loading"
                className="h-8 w-1/2 bg-white/10 rounded-md"
              />
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={cn("text-2xl font-bold", color)}
              >
                {typeof value === 'number' ? (
                  <AnimatedCounter value={value} color={color} />
                ) : (
                  value
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Sparkline chart */}
          {!loading && historyData && historyData.length > 1 && (
            <motion.div 
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              whileHover={{ opacity: 1 }}
            >
              <SparkLine 
                data={historyData} 
                color={accentColor}
                height={20}
              />
            </motion.div>
          )}
          
          {/* Trend indicator */}
          {!loading && trend !== undefined && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-1 right-1 text-xs flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
            >
              {getTrendIcon()}
              <span className={cn(
                trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-gray-400"
              )}>
                {trend > 0 ? `+${trend}%` : `${trend}%`}
              </span>
            </motion.div>
          )}
          
          {/* Expand button for detailed view */}
          {!loading && onClick && (
            <motion.div 
              className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              initial={{ opacity: 0 }}
              animate={{ opacity: expanded ? 1 : 0 }}
              whileHover={{ opacity: 1 }}
            >
              <Maximize2 className="h-3.5 w-3.5 text-white/50 hover:text-white" />
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatsCardGrid({ stats, statsLoading, className, onRefresh, colorScheme = 'default' }: StatsCardGridProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  
  // Get color scheme based on the selected theme
  const getColorScheme = () => {
    switch (colorScheme) {
      case 'vibrant':
        return {
          totalEpisodes: { text: 'text-fuchsia-400', accent: 'rgba(232,121,249,0.3)' },
          processingTime: { text: 'text-cyan-400', accent: 'rgba(34,211,238,0.3)' },
          wordCount: { text: 'text-amber-400', accent: 'rgba(251,191,36,0.3)' },
        };
      case 'minimal':
        return {
          totalEpisodes: { text: 'text-white', accent: 'rgba(255,255,255,0.3)' },
          processingTime: { text: 'text-white', accent: 'rgba(255,255,255,0.3)' },
          wordCount: { text: 'text-white', accent: 'rgba(255,255,255,0.3)' },
        };
      default:
        return {
          totalEpisodes: { text: 'text-primary', accent: 'rgba(147,197,253,0.3)' },
          processingTime: { text: 'text-purple-400', accent: 'rgba(192,132,252,0.3)' },
          wordCount: { text: 'text-amber-400', accent: 'rgba(251,191,36,0.3)' },
        };
    }
  };
  
  const colors = getColorScheme();
  
  const formatSuccessRate = (rate?: number) => {
    if (rate === undefined) return "100%";
    return `${Math.round(rate)}%`;
  };
  
  const formatWordCountValue = (wordCount?: string) => {
    if (!wordCount) return "0";
    return wordCount;
  };
  
  useEffect(() => {
    // Trigger fade-in animation after component mounts
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Format relative time for last updated
  const getLastUpdatedText = () => {
    if (!stats?.lastUpdated) return "Never updated";
    return formatRelativeTime(stats.lastUpdated);
  };
  
  const handleCardClick = (statType: string) => {
    if (expanded === statType) {
      setExpanded(null);
    } else {
      setExpanded(statType);
    }
  };
  
  // Add a title and description to the stats section
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: fadeIn ? 1 : 0, y: fadeIn ? 0 : 20 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
      className={cn("space-y-4", className)}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold group flex items-center">
            System Performance
            <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground">
              {stats?.lastUpdated && !statsLoading && `Last updated: ${getLastUpdatedText()}`}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Overview of system metrics and performance indicators</p>
        </div>
        
        {onRefresh && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onRefresh}
            disabled={statsLoading}
            className="group"
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2 transition-all",
              statsLoading ? "animate-spin" : "group-hover:animate-spin-once"
            )} />
            {statsLoading ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Episodes"
          value={stats?.totalEpisodes || 0}
          loading={statsLoading}
          icon={<Play className={cn("h-4 w-4", colors.totalEpisodes.text)} />}
          color={colors.totalEpisodes.text}
          tooltip="Total number of episodes processed by the system"
          trend={stats?.trends?.totalEpisodes}
          historyData={stats?.history?.totalEpisodes}
          onClick={() => handleCardClick('episodes')}
          expanded={expanded === 'episodes'}
          accentColor={colors.totalEpisodes.accent}
        />

        <StatCard
          title="Avg Processing Time"
          value={stats?.averageProcessingTime || "0min"}
          loading={statsLoading}
          icon={<Clock className={cn("h-4 w-4", colors.processingTime.text)} />}
          color={colors.processingTime.text}
          tooltip="Average time to process an episode"
          trend={stats?.trends?.processingTime}
          historyData={stats?.history?.processingTime}
          onClick={() => handleCardClick('processing')}
          expanded={expanded === 'processing'}
          accentColor={colors.processingTime.accent}
        />

        <StatCard
          title="Total Word Count"
          value={formatWordCountValue(stats?.totalWordCount)}
          loading={statsLoading}
          icon={<TextIcon className={cn("h-4 w-4", colors.wordCount.text)} />}
          color={colors.wordCount.text}
          tooltip="Total number of words across all transcripts"
          trend={stats?.trends?.wordCount}
          historyData={stats?.history?.wordCount}
          onClick={() => handleCardClick('wordcount')}
          expanded={expanded === 'wordcount'}
          accentColor={colors.wordCount.accent}
        />
      </div>
      
      {/* Add keyboard accessibility instructions */}
      <div className="text-xs text-muted-foreground mt-2 opacity-0 hover:opacity-70 transition-opacity">
        Tip: Click cards for details. Press Tab to navigate, Enter to select.
      </div>
    </motion.section>
  );
}

// Add this to your global CSS or create a utility class
// .animate-spin-once {
//   animation: spin 1s linear;
// }
// .animate-pulse-slow {
//   animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
// } 
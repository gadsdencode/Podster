import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSystemStats } from "@/hooks/use-episodes";
import { Activity, Cpu, HardDrive, Zap } from "lucide-react";

export default function SystemStats() {
  const { data: stats, isLoading } = useSystemStats();

  const systemMetrics = [
    {
      name: "CPU Usage",
      value: 42,
      icon: Cpu,
      color: "text-blue-400",
      bgColor: "bg-blue-500",
    },
    {
      name: "Memory",
      value: 67,
      icon: HardDrive,
      color: "text-purple-400",
      bgColor: "bg-purple-500",
    },
    {
      name: "Storage",
      value: 34,
      icon: HardDrive,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500",
    },
    {
      name: "Network",
      value: 28,
      icon: Zap,
      color: "text-amber-400",
      bgColor: "bg-amber-500",
    },
  ];

  return (
    <Card className="glassmorphism border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="mr-2 h-5 w-5" />
          System Performance
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {systemMetrics.map((metric, index) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-background/30 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                  <span className="text-sm text-muted-foreground">{metric.name}</span>
                </div>
                <span className={`text-sm font-semibold ${metric.color}`}>
                  {metric.value}%
                </span>
              </div>
              <Progress 
                value={metric.value} 
                className="h-2"
                // @ts-ignore - Progress component styling
                style={{
                  '--progress-background': `var(--${metric.bgColor.replace('bg-', '')})`,
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* System Statistics */}
        <div className="space-y-4">
          <h4 className="font-semibold">System Statistics</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm font-medium">15d 7h 32m</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Connections</span>
              <span className="text-sm font-medium">247</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Request Rate</span>
              <span className="text-sm font-medium">12.3/sec</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Error Rate</span>
              <span className="text-sm font-medium text-emerald-400">0.02%</span>
            </div>
          </div>
        </div>

        {/* Processing Queue Stats */}
        {stats && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="font-semibold">Processing Statistics</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Episodes</span>
                <span className="text-sm font-medium">{stats.totalEpisodes}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Processing Queue</span>
                <span className="text-sm font-medium">{stats.processingQueue}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="text-sm font-medium text-emerald-400">{stats.successRate}%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Daily Processed</span>
                <span className="text-sm font-medium">{stats.dailyProcessed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Method Distribution */}
        {stats?.methodDistribution && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="font-semibold">Method Distribution</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Web Scraping</span>
                <span className="text-sm font-medium text-purple-400">
                  {stats.methodDistribution.scraping}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Caption-Based</span>
                <span className="text-sm font-medium text-blue-400">
                  {stats.methodDistribution.caption}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Audio-Based</span>
                <span className="text-sm font-medium text-emerald-400">
                  {stats.methodDistribution.audio}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

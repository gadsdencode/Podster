import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSystemStats } from "@/hooks/use-episodes";
import UserManagement from "@/components/admin/user-management";
import SystemStats from "@/components/admin/system-stats";
import { 
  Settings, 
  Users, 
  Activity, 
  Database, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  BarChart3
} from "lucide-react";

export default function Admin() {
  const { data: stats, isLoading } = useSystemStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, monitor system performance, and configure settings
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* System Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SystemStats />
          </motion.div>

          {/* User Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <UserManagement />
          </motion.div>

          {/* Processing Queue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glassmorphism border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  Processing Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-background/30 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span>Advanced React Patterns</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Processing... 2:34 remaining</span>
                  </div>
                  
                  <div className="flex items-center justify-between bg-background/30 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span>JavaScript Performance</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Queued</span>
                  </div>

                  <div className="flex items-center justify-between bg-background/30 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Machine Learning Basics</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Queued</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glassmorphism border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start bg-primary hover:bg-primary/90">
                  <Download className="mr-3 h-4 w-4" />
                  Export Database
                </Button>
                <Button className="w-full justify-start bg-purple-500 hover:bg-purple-600">
                  <Database className="mr-3 h-4 w-4" />
                  Clean Cache
                </Button>
                <Button className="w-full justify-start bg-emerald-500 hover:bg-emerald-600">
                  <RefreshCw className="mr-3 h-4 w-4" />
                  Restart Services
                </Button>
                <Button className="w-full justify-start bg-red-500 hover:bg-red-600">
                  <AlertTriangle className="mr-3 h-4 w-4" />
                  Emergency Stop
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glassmorphism border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span>Episode processed successfully</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>New user registered</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span>Database backup completed</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Processing error logged</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Analytics Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glassmorphism border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-semibold text-emerald-400">
                      {isLoading ? "..." : `${stats?.successRate || 0}%`}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Daily Processed</span>
                    <span className="font-semibold text-primary">
                      {isLoading ? "..." : stats?.dailyProcessed || 0}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Queue Length</span>
                    <span className="font-semibold text-amber-400">
                      {isLoading ? "..." : stats?.processingQueue || 0}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-white/10">
                  <p className="text-xs text-muted-foreground mb-2">Method Distribution</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Web Scraping</span>
                      <span className="text-purple-400">67%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Caption-Based</span>
                      <span className="text-blue-400">24%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Audio-Based</span>
                      <span className="text-emerald-400">9%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

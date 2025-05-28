import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  Video, 
  BarChart3, 
  Settings, 
  User,
  Play
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Add Episode", href: "/add-episode", icon: Plus },
  { name: "Episodes", href: "/episodes", icon: Video },
  { name: "Search", href: "/search", icon: Search },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Admin", href: "/admin", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="fixed left-0 top-0 h-full w-64 glassmorphism border-r border-white/10 z-40">
      <div className="p-6">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-3 mb-8"
        >
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-500 rounded-xl flex items-center justify-center">
            <Play className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            TranscriptAI
          </h1>
        </motion.div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navigation.map((item, index) => {
            const isActive = location === item.href;
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-12 px-4 transition-all duration-200",
                      isActive 
                        ? "bg-primary/20 text-primary border border-primary/30" 
                        : "hover:bg-white/10 text-slate-300"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User Profile */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-6 left-6 right-6"
        >
          <div className="glassmorphism rounded-xl p-4 mb-4 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-purple-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-white/10"
          >
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

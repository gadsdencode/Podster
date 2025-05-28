import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="glassmorphism border-b border-white/10 px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 glassmorphism rounded-full px-4 py-2 border border-white/10">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm">System Online</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="glassmorphism border border-white/10 hover:bg-white/20"
          >
            <Bell className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

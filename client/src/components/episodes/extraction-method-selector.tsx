import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Zap, Globe, Mic, Lock } from "lucide-react";
import type { ExtractionMethod } from "@/types";

interface ExtractionMethodSelectorProps {
  value: ExtractionMethod;
  onChange: (method: ExtractionMethod) => void;
}

const methods = [
  {
    id: "caption" as ExtractionMethod,
    name: "📝 Caption-Based",
    description: "Fast API extraction using YouTube's built-in captions",
    icon: Zap,
    badge: "Coming Soon",
    badgeColor: "bg-gray-500/20 text-gray-400",
    pros: ["Lightning fast", "High accuracy"],
    cons: ["May be blocked"],
    iconColor: "text-gray-400",
    bgColor: "bg-gray-500/20",
    disabled: true
  },
  {
    id: "scraping" as ExtractionMethod,
    name: "🌐 Web Scraping",
    description: "Bypasses all blocks and restrictions",
    icon: Globe,
    badge: "Recommended",
    badgeColor: "bg-purple-500/20 text-purple-400",
    pros: ["Always works", "Most reliable"],
    cons: ["Slightly slower"],
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/20",
    disabled: false
  },
  {
    id: "audio" as ExtractionMethod,
    name: "🎤 Audio-Based",
    description: "Speech recognition from audio track",
    icon: Mic,
    badge: "Coming Soon",
    badgeColor: "bg-gray-500/20 text-gray-400",
    pros: ["No captions needed", "Works offline"],
    cons: ["Takes 2-5 minutes"],
    iconColor: "text-gray-400",
    bgColor: "bg-gray-500/20",
    disabled: true
  }
];

export default function ExtractionMethodSelector({ value, onChange }: ExtractionMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">Extraction Method</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {methods.map((method, index) => (
          <motion.div
            key={method.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                "transition-all duration-300 border-2",
                method.disabled 
                  ? "opacity-70 cursor-not-allowed border-gray-500/20" 
                  : "cursor-pointer hover:scale-105",
                value === method.id && !method.disabled
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                  : "glassmorphism border-white/20 hover:border-white/40"
              )}
              onClick={() => !method.disabled && onChange(method.id)}
            >
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", method.bgColor)}>
                    <method.icon className={cn("w-6 h-6", method.iconColor)} />
                  </div>
                  <span className={cn("text-xs px-2 py-1 rounded-full", method.badgeColor)}>
                    {method.badge}
                  </span>
                </div>
                
                <h5 className="font-semibold text-lg mb-2">
                  {method.name}
                  {method.disabled && (
                    <span className="ml-2 inline-flex items-center">
                      <Lock className="w-3 h-3 text-gray-400" />
                    </span>
                  )}
                </h5>
                <p className="text-sm text-muted-foreground mb-4">
                  {method.disabled ? "Future Feature - " : ""}{method.description}
                </p>
                
                <div className="space-y-2 text-xs">
                  {method.pros.map((pro, i) => (
                    <div key={i} className="flex items-center justify-center text-emerald-400">
                      <span>• {pro}</span>
                    </div>
                  ))}
                  {method.cons.map((con, i) => (
                    <div key={i} className="flex items-center justify-center text-amber-400">
                      <span>• {con}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

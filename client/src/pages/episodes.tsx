import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useEpisodes } from "@/hooks/use-episodes";
import EpisodeCard from "@/components/episodes/episode-card";
import { Search, Filter, Download, Grid, List, Plus } from "lucide-react";
import { Link } from "wouter";

export default function Episodes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const { data: episodes, isLoading } = useEpisodes();

  const filteredEpisodes = episodes?.filter(episode => {
    const matchesSearch = episode.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.channel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         episode.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || episode.status === statusFilter;
    const matchesMethod = methodFilter === "all" || episode.extractionMethod === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold">Episodes</h1>
          <p className="text-muted-foreground">
            Manage your extracted transcripts and processing queue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="glassmorphism border-white/20">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link href="/add-episode">
            <Button className="bg-gradient-to-r from-primary to-purple-500">
              <Plus className="mr-2 h-4 w-4" />
              Add Episode
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row gap-4"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search episodes, titles, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 border-white/20"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-background/50 border-white/20">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-48 bg-background/50 border-white/20">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="caption">Caption-Based</SelectItem>
            <SelectItem value="scraping">Web Scraping</SelectItem>
            <SelectItem value="audio">Audio-Based</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? "" : "glassmorphism border-white/20"}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "" : "glassmorphism border-white/20"}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Episodes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glassmorphism border-white/10 animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-1/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEpisodes.length === 0 ? (
          <Card className="glassmorphism border-white/10">
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm || statusFilter !== "all" || methodFilter !== "all" 
                    ? "No Episodes Found" 
                    : "No Episodes Yet"
                  }
                </h3>
                <p className="mb-4">
                  {searchTerm || statusFilter !== "all" || methodFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Start by adding your first YouTube video to extract transcripts."
                  }
                </p>
                <Link href="/add-episode">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Episode
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
          }>
            {filteredEpisodes.map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <EpisodeCard episode={episode} viewMode={viewMode} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Load More */}
      {filteredEpisodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <Button variant="outline" className="glassmorphism border-white/20">
            Load More Episodes
          </Button>
        </motion.div>
      )}
    </div>
  );
}

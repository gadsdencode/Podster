import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearch } from "@/hooks/use-search";
import SearchResults from "@/components/search/search-results";
import { Search, Filter, History } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  
  const { data: searchResults, isLoading, mutate: performSearch } = useSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch({
        query: query.trim(),
        filters: {
          timeRange: timeFilter,
          method: methodFilter,
          channel: channelFilter
        }
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl font-bold">Smart Search</h1>
        <p className="text-muted-foreground">
          Search across all transcripts with intelligent highlighting and filters
        </p>
      </motion.div>

      {/* Search Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glassmorphism border-white/10">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              {/* Main Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search transcripts, topics, speakers..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-12 h-12 text-lg bg-background/50 border-white/20"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="absolute right-2 top-2 bg-gradient-to-r from-primary to-purple-500"
                >
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-40 bg-background/50 border-white/20">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-48 bg-background/50 border-white/20">
                    <SelectValue placeholder="Extraction Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="caption">Caption-Based</SelectItem>
                    <SelectItem value="scraping">Web Scraping</SelectItem>
                    <SelectItem value="audio">Audio-Based</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-48 bg-background/50 border-white/20">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="techtalk">TechTalk Podcast</SelectItem>
                    <SelectItem value="business">Business Insights</SelectItem>
                    <SelectItem value="edutech">EduTech University</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search Results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {searchResults ? (
          <SearchResults results={searchResults} query={query} />
        ) : (
          <Card className="glassmorphism border-white/10">
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Start Your Search</h3>
                <p className="mb-6">
                  Enter keywords, phrases, or topics to search across all your transcripts.
                </p>
                
                {/* Search Suggestions */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Try searching for:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["artificial intelligence", "web development", "best practices", "tutorial"].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setQuery(suggestion)}
                        className="glassmorphism border-white/20 text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Recent Searches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glassmorphism border-white/10">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <History className="mr-2 h-5 w-5" />
              Recent Searches
            </h3>
            <div className="space-y-2">
              {["artificial intelligence", "react hooks", "api design"].map((recentQuery, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => setQuery(recentQuery)}
                >
                  <span className="text-sm">{recentQuery}</span>
                  <span className="text-xs text-muted-foreground">3 results</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

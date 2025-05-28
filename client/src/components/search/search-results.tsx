import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye } from "lucide-react";
import type { SearchResult } from "@shared/schema";

interface SearchResultsProps {
  results: { results: SearchResult[]; totalResults: number };
  query: string;
}

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-amber-500/30 text-amber-200 px-1 rounded">
        {part}
      </mark>
    ) : part
  );
};

export default function SearchResults({ results, query }: SearchResultsProps) {
  if (!results || results.totalResults === 0) {
    return (
      <Card className="glassmorphism border-white/10">
        <CardContent className="p-12 text-center">
          <div className="text-muted-foreground">
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p>No transcripts match your search query. Try different keywords or check your spelling.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Search Results ({results.totalResults} found)
        </h3>
        <div className="text-sm text-muted-foreground">
          Showing results for "{query}"
        </div>
      </div>

      <div className="space-y-4">
        {results.results.map((result, index) => (
          <motion.div
            key={result.episode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glassmorphism border-white/10 hover:bg-white/5 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <img 
                    src={result.episode.thumbnailUrl || "https://images.unsplash.com/photo-1589903308904-1010c2294adc?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=80"} 
                    alt={result.episode.title}
                    className="w-20 h-12 object-cover rounded-lg flex-shrink-0"
                  />
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-lg">
                        {highlightText(result.episode.title, query)}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((result.highlights[0]?.matchScore || 0) * 100)}% match
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {result.episode.channel} • {result.episode.duration} • {
                        new Date(result.episode.createdAt).toLocaleDateString()
                      }
                    </p>

                    {/* Search Highlights */}
                    <div className="space-y-3">
                      {result.highlights.slice(0, 2).map((highlight, i) => (
                        <div key={i} className="bg-background/30 rounded-lg p-4">
                          <p className="text-sm leading-relaxed">
                            {highlightText(highlight.segment, query)}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              Timestamp: {highlight.timestamp}
                            </span>
                            <Button variant="link" size="sm" className="text-primary h-auto p-0">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Jump to segment
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-3">
                        <Badge className={
                          result.episode.extractionMethod === "caption" ? "bg-blue-500/20 text-blue-400" :
                          result.episode.extractionMethod === "scraping" ? "bg-purple-500/20 text-purple-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        }>
                          {result.episode.extractionMethod === "caption" ? "Caption-Based" :
                           result.episode.extractionMethod === "scraping" ? "Web Scraping" :
                           "Audio-Based"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {result.totalMatches} matches • {result.episode.wordCount} words
                        </span>
                      </div>
                      
                      <Button variant="outline" size="sm" className="glassmorphism border-white/20">
                        <Eye className="mr-2 h-4 w-4" />
                        View Full Transcript
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination would go here */}
      <div className="flex items-center justify-center space-x-4 mt-8">
        <Button variant="outline" className="glassmorphism border-white/20" disabled>
          Previous
        </Button>
        <div className="flex items-center space-x-2">
          <Button variant="default" size="sm" className="w-8 h-8 p-0">1</Button>
          <Button variant="outline" size="sm" className="w-8 h-8 p-0 glassmorphism border-white/20">2</Button>
          <Button variant="outline" size="sm" className="w-8 h-8 p-0 glassmorphism border-white/20">3</Button>
        </div>
        <Button variant="outline" className="glassmorphism border-white/20">
          Next
        </Button>
      </div>
    </div>
  );
}

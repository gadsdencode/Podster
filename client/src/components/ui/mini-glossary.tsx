import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Copy, Download, Search, X } from "lucide-react";
import { KeywordHighlight } from "@/lib/keyword-analyzer";

interface MiniGlossaryProps {
  keywords: KeywordHighlight[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function MiniGlossary({ keywords, isOpen, onClose, title = "Episode Glossary" }: MiniGlossaryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter keywords to only include technical and concept terms with definitions
  const glossaryTerms = keywords.filter(
    keyword => 
      (keyword.category === 'technical' || keyword.category === 'concept') && 
      keyword.definition
  );

  // Apply search and category filters
  const filteredTerms = glossaryTerms.filter(term => {
    const matchesSearch = term.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.definition?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort terms alphabetically
  const sortedTerms = filteredTerms.sort((a, b) => a.keyword.localeCompare(b.keyword));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportGlossary = () => {
    const glossaryText = sortedTerms
      .map(term => `${term.keyword}: ${term.definition}`)
      .join('\n\n');
    
    const blob = new Blob([glossaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_glossary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'concept':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            {title}
            <Badge variant="outline" className="ml-2">
              {glossaryTerms.length} terms
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportGlossary}
              disabled={sortedTerms.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search terms or definitions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              <Button
                variant={selectedCategory === "technical" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("technical")}
                className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                Technical
              </Button>
              <Button
                variant={selectedCategory === "concept" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("concept")}
                className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                Concepts
              </Button>
            </div>
          </div>

          {/* Glossary Terms */}
          <ScrollArea className="flex-1 pr-4">
            {sortedTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {glossaryTerms.length === 0 ? (
                  <div>
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No definitions available yet.</p>
                    <p className="text-sm mt-1">Generate definitions for technical and concept keywords first.</p>
                  </div>
                ) : (
                  <div>
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No terms match your search.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTerms.map((term, index) => (
                  <div
                    key={`${term.keyword}-${index}`}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {term.keyword}
                        </h3>
                        <Badge variant="outline" className={getCategoryColor(term.category)}>
                          {term.category}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${term.keyword}: ${term.definition}`)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {term.definition}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
} 
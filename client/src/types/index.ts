export type ExtractionMethod = "caption" | "scraping" | "audio";

export interface SearchFilters {
  timeRange?: string;
  method?: string;
  channel?: string;
}

export interface SearchRequestPayload {
  query: string;
  filters?: SearchFilters;
}

export interface ProcessingProgress {
  episodeId: number;
  progress: number;
  estimatedTime: string;
  currentStep: string;
}

export interface TranscriptSegment {
  timestamp: string;
  text: string;
  speaker?: string;
}

export interface HighlightMatch {
  segment: string;
  timestamp: string;
  matchScore: number;
}

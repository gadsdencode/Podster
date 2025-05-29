import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Define the stats data structure
export interface StatsData {
  totalEpisodes?: number;
  successRate?: number;
  averageProcessingTime?: string;
  totalWordCount?: string;
  // Historical data for sparklines
  history?: {
    totalEpisodes?: number[];
    successRate?: number[];
    processingTime?: number[];
    wordCount?: number[];
  };
  // Add trend indicators
  trends?: {
    totalEpisodes?: number;
    successRate?: number;
    processingTime?: number;
    wordCount?: number;
  };
  lastUpdated?: string;
}

/**
 * Custom hook to fetch and manage system statistics
 * 
 * @param refreshInterval - Interval in ms to auto-refresh stats (0 to disable)
 * @param mockData - If true, returns mock data instead of making API calls (for development)
 */
export function useSystemStats(refreshInterval = 0, mockData = false) {
  const [stats, setStats] = useState<StatsData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mock data generator for development and testing
  const generateMockData = useCallback((): StatsData => {
    // Generate random values
    const totalEpisodes = Math.floor(Math.random() * 50) + 100;
    const successRate = Math.floor(Math.random() * 10) + 90;
    const processingMinutes = Math.floor(Math.random() * 15) + 5;
    const totalWordCount = Math.floor(Math.random() * 500000) + 1000000; // Between 1M and 1.5M words
    
    // Generate realistic trends
    const totalEpisodesTrend = Math.floor(Math.random() * 15) + 1;
    const successRateTrend = Math.floor(Math.random() * 5) - 2;
    const processingTimeTrend = Math.floor(Math.random() * 10) - 5;
    const wordCountTrend = Math.floor(Math.random() * 20) + 5;
    
    // Generate historical data for charts
    const generateHistory = (count: number, baseValue: number, volatility: number) => {
      const history = [baseValue];
      for (let i = 1; i < count; i++) {
        const change = (Math.random() - 0.5) * volatility;
        const newValue = Math.max(0, history[i-1] + change);
        history.push(newValue);
      }
      return history;
    };
    
    // For word count history, make it steadily increasing
    const generateWordCountHistory = (count: number, baseValue: number) => {
      const history = [baseValue * 0.1]; // Start at 10% of current value
      const step = baseValue * 0.9 / count; // Divide remaining 90% into steps
      
      for (let i = 1; i < count; i++) {
        // Add a step plus some random variation
        const randomVariation = (Math.random() * 0.4 + 0.8) * step; // 80%-120% of step
        history.push(history[i-1] + randomVariation);
      }
      
      // Make sure the last value is the current total
      history[count-1] = baseValue;
      
      return history;
    };
    
    return {
      totalEpisodes,
      successRate,
      averageProcessingTime: `${processingMinutes}min`,
      totalWordCount: totalWordCount.toLocaleString(),
      history: {
        totalEpisodes: generateHistory(20, totalEpisodes - 50, 15),
        successRate: generateHistory(20, successRate - 10, 5),
        processingTime: generateHistory(20, processingMinutes - 5, 3),
        wordCount: generateWordCountHistory(20, totalWordCount),
      },
      trends: {
        totalEpisodes: totalEpisodesTrend,
        successRate: successRateTrend,
        processingTime: processingTimeTrend,
        wordCount: wordCountTrend,
      },
      lastUpdated: new Date().toISOString(),
    };
  }, []);
  
  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    if (mockData) {
      setLoading(true);
      // Simulate API delay
      setTimeout(() => {
        setStats(generateMockData());
        setLoading(false);
        setError(null);
      }, 800);
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.get('/api/stats');
      setStats({
        ...response.data,
        lastUpdated: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      setError('Failed to fetch system statistics');
      console.error('Error fetching system stats:', err);
    } finally {
      setLoading(false);
    }
  }, [mockData, generateMockData]);
  
  // Manual refresh function
  const refreshStats = useCallback(() => {
    fetchStats();
  }, [fetchStats]);
  
  // Initial fetch and setup interval if needed
  useEffect(() => {
    fetchStats();
    
    // Set up auto-refresh interval if enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchStats, refreshInterval);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchStats, refreshInterval]);
  
  return {
    stats,
    loading,
    error,
    refreshStats,
  };
} 
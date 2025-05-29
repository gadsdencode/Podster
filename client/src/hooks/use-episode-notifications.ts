import { useEffect, useRef } from 'react';
import { useNotifications } from '@/lib/notification-context';
import { useRecentEpisodes } from '@/hooks/use-episodes';
import type { Episode } from '@shared/schema';

export function useEpisodeNotifications() {
  const { addNotification } = useNotifications();
  const { data: episodes } = useRecentEpisodes();
  
  // Keep track of the previously seen episodes
  const previousEpisodesRef = useRef<Episode[]>([]);
  
  useEffect(() => {
    if (!episodes) return;
    
    const prevEpisodes = previousEpisodesRef.current;
    
    // Find newly added episodes (not in previous list)
    const newEpisodes = episodes.filter(
      episode => !prevEpisodes.some(prev => prev.id === episode.id)
    );
    
    // Find episodes with changed status
    const statusChangedEpisodes = episodes.filter(episode => {
      const prevEpisode = prevEpisodes.find(prev => prev.id === episode.id);
      return prevEpisode && prevEpisode.status !== episode.status;
    });
    
    // Notify about new episodes
    newEpisodes.forEach(episode => {
      addNotification({
        title: 'New Episode Added',
        message: `"${episode.title}" has been added for processing`,
        type: 'info',
        link: '/episodes'
      });
    });
    
    // Notify about status changes
    statusChangedEpisodes.forEach(episode => {
      const status = episode.status;
      
      if (status === 'completed') {
        addNotification({
          title: 'Episode Processing Complete',
          message: `"${episode.title}" has been successfully processed`,
          type: 'success',
          link: '/episodes'
        });
      } else if (status === 'failed') {
        addNotification({
          title: 'Episode Processing Failed',
          message: `"${episode.title}" processing failed. Please try again.`,
          type: 'error',
          link: '/episodes'
        });
      }
    });
    
    // Update the reference to current episodes
    previousEpisodesRef.current = episodes;
  }, [episodes, addNotification]);
} 
import { useEffect } from 'react';
import { useNotifications } from '@/lib/notification-context';

// App version for checking updates
const APP_VERSION = '1.0.0';
const APP_VERSION_KEY = 'podster_app_version';

// Define list of updates
const APP_UPDATES = [
  {
    version: '1.0.0',
    updates: [
      {
        title: 'Welcome to Podster',
        message: 'Your AI-powered podcast transcript analysis platform is ready to use.',
        type: 'info' as const,
        link: '/'
      },
      {
        title: 'New Feature: Notifications',
        message: 'Stay updated with the latest application changes and features.',
        type: 'success' as const,
        link: null
      },
      {
        title: 'Get Started',
        message: 'Start by adding a podcast episode to extract and analyze.',
        type: 'info' as const,
        link: '/add-episode'
      }
    ]
  },
  // Add future app versions and their updates here
  // {
  //   version: '1.0.1',
  //   updates: [...]
  // }
];

export function useAppUpdates() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Get the last seen app version from local storage
    const lastSeenVersion = localStorage.getItem(APP_VERSION_KEY) || '0.0.0';
    
    // If this is the first time or there's a version update
    if (lastSeenVersion !== APP_VERSION) {
      // Find all updates that are newer than the last seen version
      const newUpdates = APP_UPDATES.filter(update => {
        // Simple semver comparison (only works for basic version numbering)
        return compareVersions(update.version, lastSeenVersion) > 0;
      });
      
      // Add notifications for all new updates
      newUpdates.forEach(update => {
        update.updates.forEach(notification => {
          addNotification({
            title: notification.title,
            message: notification.message,
            type: notification.type,
            link: notification.link || undefined
          });
        });
      });
      
      // Update the last seen version
      localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    }
  }, [addNotification]);

  // Function to add a custom update notification
  const addAppUpdate = (update: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    link?: string;
  }) => {
    addNotification(update);
  };

  return { addAppUpdate };
}

// Simple version comparison function
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
} 
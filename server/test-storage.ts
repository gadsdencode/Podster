import { storage } from './storage';
import { db } from './db';
import { searchQueries } from '@shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function testStorage() {
  try {
    console.log('Testing PostgresStorage implementation...');
    
    // Generate unique identifiers using timestamp
    const timestamp = Date.now();
    const username = `testuser_${timestamp}`;
    const email = `test${timestamp}@example.com`;
    const videoId = `testid_${timestamp}`;
    
    // Create a test user
    const testUser = await storage.createUser({
      username,
      email,
      password: "hashedpassword123",
      role: "user"
    });
    
    console.log('Created test user:', testUser);
    
    // Get the user back
    const retrievedUser = await storage.getUserByUsername(username);
    console.log('Retrieved user:', retrievedUser);
    
    // Create a test episode
    const testEpisode = await storage.createEpisode({
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      extractionMethod: "caption",
      userId: testUser.id
    });
    
    console.log('Created test episode:', testEpisode);
    
    // Update the episode with more data
    const updatedEpisode = await storage.updateEpisode(testEpisode.id, {
      title: "Test Episode Title",
      status: "completed",
      transcript: "This is a test transcript for our episode.",
      processingCompleted: new Date()
    });
    
    console.log('Updated episode:', updatedEpisode);
    
    // Get all episodes for the user
    const episodes = await storage.getAllEpisodes(testUser.id);
    console.log('User episodes:', episodes);
    
    // Search for transcripts
    const searchResults = await storage.searchTranscripts("test", testUser.id);
    console.log('Search results:', searchResults);
    
    // Create a search query record
    const searchQuery = await storage.createSearchQuery({
      query: "test",
      userId: testUser.id,
      resultCount: searchResults.length
    });
    
    console.log('Saved search query:', searchQuery);
    
    // Get recent searches
    const recentSearches = await storage.getRecentSearches(testUser.id);
    console.log('Recent searches:', recentSearches);
    
    // Get system stats
    const stats = await storage.getSystemStats();
    console.log('System stats:', stats);
    
    // Get user stats
    const userStats = await storage.getUserStats(testUser.id);
    console.log('User stats:', userStats);
    
    console.log('PostgresStorage test completed successfully!');
    
    // Clean up - Delete test data (in the correct order for foreign key constraints)
    // First delete search queries
    await db.delete(searchQueries).where(eq(searchQueries.userId, testUser.id));
    // Then delete episodes
    await storage.deleteEpisode(testEpisode.id);
    // Finally delete user
    await storage.deleteUser(testUser.id);
    
    console.log('Test data cleanup completed successfully');
    
  } catch (error) {
    console.error('Error testing PostgresStorage:', error);
  } finally {
    process.exit(0);
  }
}

testStorage(); 
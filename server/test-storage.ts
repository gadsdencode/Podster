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
    
    // Test the improved transcript formatting
    console.log("\n--- Testing Transcript Formatting ---");
    try {
      await testTranscriptFormatting();
      console.log("Transcript formatting test completed successfully");
    } catch (error) {
      console.error("Error in transcript formatting test:", error);
    }
    
  } catch (error) {
    console.error('Error testing PostgresStorage:', error);
  } finally {
    process.exit(0);
  }
}

// Add a test transcript with our new format
const formattedTranscript = `[0:00] Welcome to this podcast episode where we discuss various topics related to technology and its impact on society.

[1:30] The first topic we'll cover is artificial intelligence and how it's changing the way we work. Machine learning algorithms are becoming more sophisticated every day.

[3:45] Next, we'll talk about data privacy concerns in the digital age. Many users are unaware of how their personal information is being collected and used.

[7:15] Finally, we'll discuss the future of remote work and how technology is enabling new ways of collaboration across distances.`;

// Test function to demonstrate the improved transcript formatting
async function testTranscriptFormatting() {
  console.log("Testing improved transcript formatting");
  
  // Create a test user
  const testUser = {
    username: "test_user",
    email: "test@example.com",
    password: "password123",
    role: "user"
  };
  
  // Find or create the user
  let user = await storage.getUserByEmail(testUser.email);
  if (!user) {
    user = await storage.createUser(testUser);
    console.log(`Created test user with ID ${user.id}`);
  }
  
  const formattedEpisode = {
    youtubeUrl: `https://www.youtube.com/watch?v=test-formatted-id`,
    extractionMethod: "caption" as "caption" | "scraping" | "audio",
    userId: user.id,
    status: "completed"
  };
  
  // Save the formatted episode
  const savedEpisode = await storage.createEpisode(formattedEpisode);
  console.log(`Saved formatted episode with ID ${savedEpisode.id}`);
  
  // Update the episode with more data
  const updatedEpisode = await storage.updateEpisode(savedEpisode.id, {
    title: "Test Formatted Transcript",
    channel: "Test Channel",
    videoId: "test-formatted-id",
    transcript: formattedTranscript,
    status: "completed",
    processingCompleted: new Date()
  });
  
  if (!updatedEpisode) {
    console.error("Failed to update episode");
    return null;
  }

  // Retrieve the episode to verify formatting is preserved
  const retrievedEpisode = await storage.getEpisode(updatedEpisode.id);
  console.log("Retrieved formatted transcript:");
  console.log(retrievedEpisode?.transcript);
  
  return retrievedEpisode;
}

// Export the test function
export { testTranscriptFormatting };

testStorage(); 
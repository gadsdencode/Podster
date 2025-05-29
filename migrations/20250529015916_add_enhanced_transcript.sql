
      -- Add enhancedTranscript and hasEnhancedTranscript columns to episodes table
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS enhanced_transcript TEXT;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS has_enhanced_transcript BOOLEAN DEFAULT FALSE;
    
CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"channel" text,
	"duration" text,
	"thumbnail_url" text,
	"youtube_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"extraction_method" text NOT NULL,
	"transcript" text,
	"summary" text,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"word_count" integer,
	"progress" integer DEFAULT 0,
	"current_step" text DEFAULT 'Preparing to process...',
	"processing_started" timestamp,
	"processing_completed" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" integer NOT NULL,
	"generate_summary" boolean DEFAULT false,
	"extract_topics" boolean DEFAULT false,
	CONSTRAINT "episodes_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE TABLE "processing_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"priority" integer DEFAULT 0,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"user_id" integer,
	"result_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_queue" ADD CONSTRAINT "processing_queue_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
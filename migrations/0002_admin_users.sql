CREATE TABLE "admin" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_username_unique" UNIQUE("username")
);

-- Insert the hardcoded admin user
INSERT INTO "admin" ("username", "password") VALUES ('admin', 'abc3abcabcabc'); 
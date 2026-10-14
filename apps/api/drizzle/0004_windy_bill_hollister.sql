CREATE TABLE "garden_entity_links" (
	"user_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"target_id" varchar(100) NOT NULL,
	CONSTRAINT "garden_entity_links_user_id_kind_source_id_pk" PRIMARY KEY("user_id","kind","source_id")
);
--> statement-breakpoint
ALTER TABLE "garden_entity_links" ADD CONSTRAINT "garden_entity_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill identity guards from existing snapshots; no user data is deleted.
INSERT INTO garden_entity_links (user_id, kind, source_id, target_id)
SELECT user_id, 'task_action', record->>'sourceTaskId', record->>'id'
FROM garden_snapshots, jsonb_array_elements(state->'records') AS record
WHERE record->>'sourceTaskId' IS NOT NULL;
--> statement-breakpoint
INSERT INTO garden_entity_links (user_id, kind, source_id, target_id)
SELECT user_id, 'goal_result', result->>'goalId', result->>'id'
FROM garden_snapshots, jsonb_array_elements(state->'results') AS result;
--> statement-breakpoint
INSERT INTO garden_entity_links (user_id, kind, source_id, target_id)
SELECT user_id, 'growth_action', event->>'actionId', event->>'id'
FROM garden_snapshots, jsonb_array_elements(state->'growthEvents') AS event;

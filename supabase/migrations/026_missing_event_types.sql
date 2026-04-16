-- Add event types used by pull-history and weekly-perf routes
ALTER TYPE log_event_type ADD VALUE IF NOT EXISTS 'lead_pulled';
ALTER TYPE log_event_type ADD VALUE IF NOT EXISTS 'lead_auto_pulled';
ALTER TYPE log_event_type ADD VALUE IF NOT EXISTS 'door_knock';

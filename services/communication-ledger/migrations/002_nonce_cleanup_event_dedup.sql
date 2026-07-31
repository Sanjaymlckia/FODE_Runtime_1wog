ALTER TABLE communication_events ADD COLUMN event_fingerprint CHAR(64) NULL, ADD UNIQUE KEY uq_event_fingerprint (event_fingerprint);

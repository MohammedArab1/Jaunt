export const schemaSql = `
CREATE SEQUENCE IF NOT EXISTS sync_revision_seq;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS trips (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  destination text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  color text NOT NULL,
  emoji text NOT NULL,
  notes text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  revision bigint NOT NULL DEFAULT nextval('sync_revision_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS trips_user_revision_idx ON trips(user_id, revision);

-- Public read-only share links. A null token means the trip is private.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS trips_share_token_idx ON trips(share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS activities (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  trip_id text,
  name text NOT NULL,
  date date NOT NULL,
  end_date date,
  start_time text,
  end_time text,
  time_slot text,
  location text,
  type text NOT NULL,
  notes text,
  confirmation text,
  url text,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  revision bigint NOT NULL DEFAULT nextval('sync_revision_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS activities_user_revision_idx ON activities(user_id, revision);
CREATE INDEX IF NOT EXISTS activities_user_trip_idx ON activities(user_id, trip_id);
CREATE INDEX IF NOT EXISTS activities_user_date_idx ON activities(user_id, date);
CREATE INDEX IF NOT EXISTS activities_trip_revision_idx ON activities(trip_id, revision);

-- Add columns for databases created before multi-day plans and day-part slots.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS time_slot text;

CREATE UNIQUE INDEX IF NOT EXISTS trips_global_id_idx ON trips(id);
CREATE UNIQUE INDEX IF NOT EXISTS activities_global_id_idx ON activities(id);

CREATE TABLE IF NOT EXISTS trip_members (
  trip_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS trip_members_user_status_idx ON trip_members(user_id, status);
CREATE INDEX IF NOT EXISTS trip_members_trip_status_idx ON trip_members(trip_id, status);

CREATE TABLE IF NOT EXISTS attachments (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  activity_id text NOT NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  revision bigint NOT NULL DEFAULT nextval('sync_revision_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, activity_id) REFERENCES activities(user_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS attachments_global_id_idx ON attachments(id);
CREATE INDEX IF NOT EXISTS attachments_user_revision_idx ON attachments(user_id, revision);
CREATE INDEX IF NOT EXISTS attachments_activity_idx ON attachments(activity_id);

CREATE TABLE IF NOT EXISTS attachment_files (
  user_id uuid NOT NULL,
  attachment_id text NOT NULL,
  data bytea NOT NULL,
  PRIMARY KEY (user_id, attachment_id),
  FOREIGN KEY (user_id, attachment_id) REFERENCES attachments(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tombstones (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('trip', 'activity', 'attachment')),
  entity_id text NOT NULL,
  deleted_at bigint NOT NULL,
  revision bigint NOT NULL,
  PRIMARY KEY (user_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS tombstones_user_revision_idx ON tombstones(user_id, revision);
`

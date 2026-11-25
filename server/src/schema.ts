export const schemaSql = `
CREATE SEQUENCE IF NOT EXISTS sync_revision_seq;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text,
  display_name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing databases created before external sign-in required a password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- External OIDC identities. The provider subject is the stable identifier;
-- email is informational and can change at the provider.
CREATE TABLE IF NOT EXISTS user_identities (
  provider text NOT NULL,
  subject text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities(user_id);

-- Short-lived OAuth transactions for state, nonce, and PKCE verification.
CREATE TABLE IF NOT EXISTS oauth_transactions (
  state text PRIMARY KEY,
  provider text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('login', 'link')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_transactions_mode_user_check CHECK (
    (mode = 'link' AND user_id IS NOT NULL) OR (mode = 'login' AND user_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS oauth_transactions_expires_at_idx ON oauth_transactions(expires_at);

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
  destinations jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  revision bigint NOT NULL DEFAULT nextval('sync_revision_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS trips_user_revision_idx ON trips(user_id, revision);

-- Public read-only share links. A null token means the trip is private.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_token text;
CREATE UNIQUE INDEX IF NOT EXISTS trips_share_token_idx ON trips(share_token) WHERE share_token IS NOT NULL;

-- Structured destinations (name, coordinates, timezone) for weather and maps.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS destinations jsonb;

CREATE TABLE IF NOT EXISTS activities (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  trip_id text,
  destination_id text,
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

-- Add columns for databases created before multi-day plans, day-part slots,
-- and trip-destination-linked plans.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS time_slot text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS destination_id text;

CREATE UNIQUE INDEX IF NOT EXISTS trips_global_id_idx ON trips(id);
CREATE UNIQUE INDEX IF NOT EXISTS activities_global_id_idx ON activities(id);

-- user_id is the trip owner who stores the row. owner_user_id is the traveler
-- whose personal packing list the item belongs to.
CREATE TABLE IF NOT EXISTS packing_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  trip_id text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('documents', 'clothing', 'toiletries', 'electronics', 'gear', 'other')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 99),
  packed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  revision bigint NOT NULL DEFAULT nextval('sync_revision_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, trip_id) REFERENCES trips(user_id, id) ON DELETE CASCADE
);

-- Databases created before personal packing lists had one list per trip.
-- Backfill ownership to the trip owner and force clients to re-pull the rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'packing_items'
      AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE packing_items
      ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
    UPDATE packing_items SET owner_user_id = user_id;
    ALTER TABLE packing_items ALTER COLUMN owner_user_id SET NOT NULL;
    UPDATE packing_items SET revision = nextval('sync_revision_seq');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS packing_items_global_id_idx ON packing_items(id);
CREATE INDEX IF NOT EXISTS packing_items_user_revision_idx ON packing_items(user_id, revision);
CREATE INDEX IF NOT EXISTS packing_items_trip_idx ON packing_items(trip_id);
CREATE INDEX IF NOT EXISTS packing_items_trip_owner_idx ON packing_items(trip_id, owner_user_id);
CREATE INDEX IF NOT EXISTS packing_items_trip_revision_idx ON packing_items(trip_id, revision);

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
  entity_type text NOT NULL CHECK (entity_type IN ('trip', 'activity', 'attachment', 'packing')),
  entity_id text NOT NULL,
  deleted_at bigint NOT NULL,
  revision bigint NOT NULL,
  PRIMARY KEY (user_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS tombstones_user_revision_idx ON tombstones(user_id, revision);

-- Older databases created the tombstone table before packing items existed.
ALTER TABLE tombstones DROP CONSTRAINT IF EXISTS tombstones_entity_type_check;
ALTER TABLE tombstones ADD CONSTRAINT tombstones_entity_type_check
  CHECK (entity_type IN ('trip', 'activity', 'attachment', 'packing'));
`

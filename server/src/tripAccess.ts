import type { Pool, PoolClient } from 'pg'

type DbClient = Pool | PoolClient

export async function acquireSyncLock(client: DbClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('jaunt-sync')::bigint)")
}

export interface TripAccess {
  ownerId: string
  role: 'owner' | 'member'
}

export interface ActivityMeta {
  id: string
  user_id: string
  trip_id: string | null
}

export async function findTripOwner(client: DbClient, tripId: string): Promise<string | null> {
  const result = await client.query<{ user_id: string }>('SELECT user_id FROM trips WHERE id = $1 LIMIT 1', [
    tripId,
  ])
  return result.rows[0]?.user_id ?? null
}

export async function getTripAccess(
  client: DbClient,
  userId: string,
  tripId: string,
): Promise<TripAccess | null> {
  const ownerId = await findTripOwner(client, tripId)
  if (!ownerId) return null
  if (ownerId === userId) return { ownerId, role: 'owner' }

  const member = await client.query(
    `SELECT 1 FROM trip_members
     WHERE trip_id = $1 AND user_id = $2 AND status = 'accepted'`,
    [tripId, userId],
  )

  return member.rowCount ? { ownerId, role: 'member' } : null
}

export async function getAcceptedMemberIds(client: DbClient, tripId: string): Promise<string[]> {
  const result = await client.query<{ user_id: string }>(
    `SELECT user_id FROM trip_members WHERE trip_id = $1 AND status = 'accepted'`,
    [tripId],
  )
  return result.rows.map((row) => row.user_id)
}

export async function getTripParticipantIds(client: DbClient, tripId: string): Promise<string[]> {
  const ownerId = await findTripOwner(client, tripId)
  if (!ownerId) return []
  const members = await getAcceptedMemberIds(client, tripId)
  return [...new Set([ownerId, ...members])]
}

export async function getTripHasMembers(client: DbClient, tripId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM trip_members WHERE trip_id = $1 AND status = 'accepted' LIMIT 1`,
    [tripId],
  )
  return Boolean(result.rowCount)
}

export async function getActivityMeta(
  client: DbClient,
  activityId: string,
): Promise<ActivityMeta | null> {
  const result = await client.query<ActivityMeta>(
    'SELECT id, user_id, trip_id FROM activities WHERE id = $1 LIMIT 1',
    [activityId],
  )
  return result.rows[0] ?? null
}

export async function canAccessActivity(
  client: DbClient,
  userId: string,
  activity: ActivityMeta,
): Promise<boolean> {
  if (activity.trip_id) {
    return Boolean(await getTripAccess(client, userId, activity.trip_id))
  }
  return activity.user_id === userId
}

export async function getActivityParticipants(
  client: DbClient,
  activity: ActivityMeta,
): Promise<string[]> {
  if (activity.trip_id) return getTripParticipantIds(client, activity.trip_id)
  return [activity.user_id]
}

export async function addTombstones(
  client: DbClient,
  userIds: string[],
  entity: 'trip' | 'activity' | 'attachment' | 'packing',
  entityId: string,
  deletedAt: number,
): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    await client.query(
      `INSERT INTO tombstones (user_id, entity_type, entity_id, deleted_at, revision)
       VALUES ($1, $2, $3, $4, nextval('sync_revision_seq'))
       ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
         deleted_at = EXCLUDED.deleted_at,
         revision = nextval('sync_revision_seq')`,
      [userId, entity, entityId, deletedAt],
    )
  }
}

export async function bumpTripRevisions(client: DbClient, tripId: string): Promise<void> {
  await client.query(`UPDATE trips SET revision = nextval('sync_revision_seq') WHERE id = $1`, [tripId])
  await client.query(
    `UPDATE activities SET revision = nextval('sync_revision_seq') WHERE trip_id = $1`,
    [tripId],
  )
  await client.query(
    `UPDATE packing_items SET revision = nextval('sync_revision_seq') WHERE trip_id = $1`,
    [tripId],
  )
  await client.query(
    `UPDATE attachments
     SET revision = nextval('sync_revision_seq')
     WHERE activity_id IN (SELECT id FROM activities WHERE trip_id = $1)`,
    [tripId],
  )
}

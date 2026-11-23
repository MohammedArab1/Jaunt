import pg from 'pg'
import { config } from './config.js'
import { schemaSql } from './schema.js'

const { Pool } = pg
pg.types.setTypeParser(20, (value: string) => Number(value))

export const pool = new Pool(config.database)

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function prepareDatabase(): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (error) {
      lastError = error
      console.log(`Waiting for PostgreSQL (attempt ${attempt}/30)…`)
      await sleep(1000)
    }
  }

  if (lastError) {
    try {
      await pool.query('SELECT 1')
    } catch {
      throw lastError
    }
  }

  // API replicas can start together after a recreate. Serialize the idempotent
  // schema statements so concurrent CREATE/ALTER statements cannot race.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('jaunt-schema')::bigint)")
    await client.query(schemaSql)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end()
}

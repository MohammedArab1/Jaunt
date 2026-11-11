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

  await pool.query(schemaSql)
}

export async function closeDatabase(): Promise<void> {
  await pool.end()
}

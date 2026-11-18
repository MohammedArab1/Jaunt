function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function listFromEnv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => {
      try {
        return new URL(item.trim()).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

function sameSiteFromEnv(value: string | undefined): 'lax' | 'strict' | 'none' {
  return value === 'none' || value === 'strict' ? value : 'lax'
}

export const config = {
  port: numberFromEnv(process.env.PORT, 3100),
  isProduction: process.env.NODE_ENV === 'production',
  sessionDays: numberFromEnv(process.env.SESSION_DAYS, 90),
  cookieSecure:
    process.env.COOKIE_SECURE === undefined
      ? process.env.NODE_ENV === 'production'
      : process.env.COOKIE_SECURE === 'true',
  bcryptRounds: numberFromEnv(process.env.BCRYPT_ROUNDS, 12),
  // Set when the SPA is served from a different origin than this API.
  corsOrigins: listFromEnv(process.env.CORS_ORIGIN),
  cookieSameSite: sameSiteFromEnv(process.env.COOKIE_SAMESITE),
  database: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 10,
      }
    : {
        host: process.env.PGHOST ?? '127.0.0.1',
        port: numberFromEnv(process.env.PGPORT ?? process.env.DB_PORT, 5432),
        user: process.env.PGUSER ?? 'jaunt',
        password: process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'jaunt-local',
        database: process.env.PGDATABASE ?? 'jaunt',
        max: 10,
      },
}

export const SESSION_COOKIE = 'jaunt_session'

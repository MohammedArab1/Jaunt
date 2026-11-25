function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
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
  publicUrl: trimTrailingSlash((process.env.PUBLIC_URL ?? '').trim()),
  oauth: {
    google: {
      clientId: (process.env.GOOGLE_CLIENT_ID ?? '').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
      issuer: (process.env.GOOGLE_ISSUER ?? '').trim() || 'https://accounts.google.com',
    },
  },
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

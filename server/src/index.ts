import express, { type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { config } from './config.js'
import { closeDatabase, pool, prepareDatabase } from './db.js'
import authRouter from './routes/auth.js'
import syncRouter from './routes/sync.js'
import attachmentsRouter from './routes/attachments.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }),
)
app.use(cookieParser())

// Same-origin check for state-changing requests. The SPA and API share an origin.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next()
    return
  }

  const origin = req.get('origin')
  if (!origin) {
    next()
    return
  }

  try {
    const originHost = new URL(origin).host
    const requestHost = req.get('host')
    if (!requestHost || originHost !== requestHost) {
      res.status(403).json({ error: 'Cross-origin request blocked.' })
      return
    }
  } catch {
    res.status(403).json({ error: 'Invalid request origin.' })
    return
  }

  next()
})

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, database: true })
  } catch {
    res.status(503).json({ ok: false, database: false })
  }
})

// The attachment upload route needs the raw body, so it must come before express.json().
app.use('/api/attachments', attachmentsRouter)
app.use(express.json({ limit: '5mb' }))
app.use('/api/auth', authRouter)
app.use('/api/sync', syncRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'That file is too large.' })
      return
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'The request body is not valid JSON.' })
      return
    }
  }

  console.error(error)
  if (!res.headersSent) {
    res.status(500).json({ error: 'Something went wrong on the server.' })
  }
})

async function start(): Promise<void> {
  await prepareDatabase()

  const server = app.listen(config.port, () => {
    console.log(`Jaunt API listening on port ${config.port}`)
  })

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down…`)
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

void start().catch((error) => {
  console.error('Could not start the Jaunt API:', error)
  process.exit(1)
})

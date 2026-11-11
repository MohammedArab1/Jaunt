import { Router, type NextFunction, type Request, type Response } from 'express'
import express from 'express'
import { pool } from '../db.js'
import { currentUser, requireAuth } from '../auth.js'
import { acquireSyncLock, canAccessActivity, getActivityMeta } from '../tripAccess.js'

const router = Router()

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

router.put(
  '/:id/file',
  requireAuth,
  express.raw({ type: () => true, limit: '30mb' }),
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const attachmentId = String(req.params.id ?? '')
    const body = req.body

    if (!attachmentId || attachmentId.length > 100) {
      res.status(400).json({ error: 'Invalid attachment id.' })
      return
    }

    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: 'The uploaded file is empty.' })
      return
    }

    const attachmentResult = await pool.query<{ user_id: string; activity_id: string }>(
      'SELECT user_id, activity_id FROM attachments WHERE id = $1 LIMIT 1',
      [attachmentId],
    )
    const attachment = attachmentResult.rows[0]
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found. Sync its metadata first.' })
      return
    }

    const activity = await getActivityMeta(pool, attachment.activity_id)
    if (!activity || !(await canAccessActivity(pool, userId, activity))) {
      res.status(404).json({ error: 'Attachment not found.' })
      return
    }

    const ownerId = attachment.user_id
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await acquireSyncLock(client)
      await client.query(
        `INSERT INTO attachment_files (user_id, attachment_id, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, attachment_id) DO UPDATE SET data = EXCLUDED.data`,
        [ownerId, attachmentId, body],
      )
      await client.query(
        `UPDATE attachments
         SET revision = nextval('sync_revision_seq')
         WHERE user_id = $1 AND id = $2`,
        [ownerId, attachmentId],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    res.json({ ok: true })
  }),
)

router.get(
  '/:id/file',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const attachmentId = String(req.params.id ?? '')

    const attachmentResult = await pool.query<{ user_id: string; activity_id: string }>(
      'SELECT user_id, activity_id FROM attachments WHERE id = $1 LIMIT 1',
      [attachmentId],
    )
    const attachment = attachmentResult.rows[0]
    if (!attachment) {
      res.status(404).json({ error: 'Attachment file not found.' })
      return
    }

    const activity = await getActivityMeta(pool, attachment.activity_id)
    if (!activity || !(await canAccessActivity(pool, userId, activity))) {
      res.status(404).json({ error: 'Attachment file not found.' })
      return
    }

    const result = await pool.query<{ data: Buffer; mime_type: string; name: string }>(
      `SELECT f.data, a.mime_type, a.name
       FROM attachment_files f
       JOIN attachments a ON a.user_id = f.user_id AND a.id = f.attachment_id
       WHERE f.user_id = $1 AND f.attachment_id = $2`,
      [attachment.user_id, attachmentId],
    )

    const row = result.rows[0]
    if (!row) {
      res.status(404).json({ error: 'Attachment file not found.' })
      return
    }

    const safeName = row.name.replace(/["\r\n]/g, '_').slice(0, 200)
    const displaySafe =
      row.mime_type === 'application/pdf' ||
      (row.mime_type.startsWith('image/') && row.mime_type !== 'image/svg+xml')
    const contentType = displaySafe ? row.mime_type : 'application/octet-stream'
    const disposition = displaySafe ? 'inline' : 'attachment'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(row.data.length))
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(row.data)
  }),
)

export default router

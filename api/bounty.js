/*
 * Bounty API - 悬赏系统后端
 * 数据库表: bounties
 * OSS 目录: bounties/ (悬赏图), bounty-deliveries/ (交付图)
 *
 * ── 需要新增的数据库字段 ──
 * ALTER TABLE bounties
 *   ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open',
 *   ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(100),
 *   ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP,
 *   ADD COLUMN IF NOT EXISTS delivery_image_url TEXT,
 *   ADD COLUMN IF NOT EXISTS delivery_materials TEXT,
 *   ADD COLUMN IF NOT EXISTS signature VARCHAR(200),
 *   ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
 *   ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
 *
 * CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
 */

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { Client } = require('pg');
const OSS = require('ali-oss');

/* ── 通用函数 ── */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function parseBase64Image(imageBase64) {
  const input = String(imageBase64 || '');
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid base64 image payload');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function createDbClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

function createOssClient() {
  return new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
  });
}

async function uploadToOSS(buffer, mimeType, prefix = 'bounties') {
  const ossClient = createOssClient();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `${prefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  await ossClient.put(key, buffer);
  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION || '';
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

function rowToFrontend(row) {
  return {
    id: typeof row.id === 'number' ? `bounty_${row.id}` : row.id,
    dbId: typeof row.id === 'number' ? row.id : row.id.replace('bounty_', ''),
    title: row.title || '',
    description: row.description,
    reward: row.reward,
    image_url: row.image_url,
    created_at: row.created_at,
    status: row.status || 'open',
    claimed_by: row.claimed_by || null,
    claimed_at: row.claimed_at,
    delivery_image_url: row.delivery_image_url || null,
    delivery_materials: row.delivery_materials || null,
    signature: row.signature || null,
    completed_at: row.completed_at,
    refunded_at: row.refunded_at,
  };
}

function safeEnd(dbClient) {
  return dbClient.end().catch(() => {});
}

/* ── 主路由 ── */

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!process.env.DATABASE_URL) {
    console.error('致命错误: 环境变量 DATABASE_URL 缺失！');
    return res.status(500).json({ error: '服务器配置异常，未找到数据库链接' });
  }

  const db = createDbClient();
  try { await db.connect(); } catch (err) {
    console.error('[api/bounty] db connect failed', err);
    await safeEnd(db);
    return res.status(500).json({ ok: false, error: 'Failed to connect database' });
  }

  try {
    /* ── GET: 查询悬赏列表 ── */
    if (req.method === 'GET') {
      const { status, id } = req.query || {};

      if (id) {
        // 查询单条
        const dbId = String(id).startsWith('bounty_') ? String(id).replace('bounty_', '') : id;
        const { rows } = await db.query('SELECT * FROM bounties WHERE id = $1', [dbId]);
        await safeEnd(db);
        if (!rows.length) return res.status(404).json({ ok: false, error: 'Bounty not found' });
        return res.status(200).json({ ok: true, data: rowToFrontend(rows[0]) });
      }

      let query = 'SELECT * FROM bounties';
      const params = [];
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC, id DESC LIMIT 100';

      const { rows } = await db.query(query, params);
      await safeEnd(db);
      return res.status(200).json({ ok: true, data: rows.map(rowToFrontend) });
    }

    /* ── POST: 发布新悬赏 ── */
    if (req.method === 'POST') {
      const { description, reward, imageBase64, title } = req.body || {};
      if (!description || !imageBase64) {
        await safeEnd(db);
        return res.status(400).json({ ok: false, error: 'description and imageBase64 are required' });
      }
      const rewardAmount = Number(reward) || 200;
      if (rewardAmount <= 0) {
        await safeEnd(db);
        return res.status(400).json({ ok: false, error: 'reward must be a positive number' });
      }

      const { mimeType, buffer } = parseBase64Image(imageBase64);
      const imageUrl = await uploadToOSS(buffer, mimeType, 'bounties');

      const bountyTitle = title || description.slice(0, 20);
      const { rows } = await db.query(
        `INSERT INTO bounties (title, description, reward, image_url, status)
         VALUES ($1, $2, $3, $4, 'open')
         RETURNING *`,
        [bountyTitle, String(description).trim(), rewardAmount, imageUrl]
      );
      await safeEnd(db);
      return res.status(201).json({ ok: true, data: rowToFrontend(rows[0]) });
    }

    /* ── PATCH: 状态变更（认领/交付/完成/退回） ── */
    if (req.method === 'PATCH') {
      const { id, action, claimedBy, signature, deliveryMaterials, deliveryImageBase64 } = req.body || {};

      if (!id || !action) {
        await safeEnd(db);
        return res.status(400).json({ ok: false, error: 'id and action are required' });
      }

      const dbId = String(id).startsWith('bounty_') ? String(id).replace('bounty_', '') : id;

      // 先查当前状态
      const { rows: existing } = await db.query('SELECT * FROM bounties WHERE id = $1', [dbId]);
      if (!existing.length) {
        await safeEnd(db);
        return res.status(404).json({ ok: false, error: 'Bounty not found' });
      }
      const bounty = existing[0];

      // ── action: claim ──
      if (action === 'claim') {
        if (bounty.status !== 'open') {
          await safeEnd(db);
          return res.status(400).json({ ok: false, error: `Bounty is not available (current status: ${bounty.status})` });
        }
        const { rows: updated } = await db.query(
          `UPDATE bounties SET status = 'claimed', claimed_by = $1, claimed_at = NOW()
           WHERE id = $2 RETURNING *`,
          [String(claimedBy || 'anonymous').trim(), dbId]
        );
        await safeEnd(db);
        return res.status(200).json({ ok: true, data: rowToFrontend(updated[0]), message: 'Bounty claimed successfully' });
      }

      // ── action: deliver ──
      if (action === 'deliver') {
        if (bounty.status !== 'claimed') {
          await safeEnd(db);
          return res.status(400).json({ ok: false, error: `Bounty must be claimed first (current status: ${bounty.status})` });
        }

        let deliveryImageUrl = bounty.delivery_image_url;
        if (deliveryImageBase64) {
          const { mimeType, buffer } = parseBase64Image(deliveryImageBase64);
          deliveryImageUrl = await uploadToOSS(buffer, mimeType, 'bounty-deliveries');
        }

        const materials = deliveryMaterials || '';
        const sig = signature || bounty.signature || '';

        const { rows: updated } = await db.query(
          `UPDATE bounties SET status = 'delivered', delivery_image_url = $1, delivery_materials = $2, signature = $3
           WHERE id = $4 RETURNING *`,
          [deliveryImageUrl, materials, sig, dbId]
        );
        await safeEnd(db);
        return res.status(200).json({ ok: true, data: rowToFrontend(updated[0]), message: 'Delivery submitted' });
      }

      // ── action: complete ──
      if (action === 'complete') {
        if (bounty.status !== 'claimed' && bounty.status !== 'delivered') {
          await safeEnd(db);
          return res.status(400).json({ ok: false, error: `Bounty cannot be completed (current status: ${bounty.status})` });
        }
        const sig = signature || bounty.signature || '';
        const { rows: updated } = await db.query(
          `UPDATE bounties SET status = 'completed', signature = $1, completed_at = NOW()
           WHERE id = $2 RETURNING *`,
          [sig, dbId]
        );
        await safeEnd(db);
        return res.status(200).json({ ok: true, data: rowToFrontend(updated[0]), message: 'Bounty completed' });
      }

      // ── action: refund ──
      if (action === 'refund') {
        if (bounty.status !== 'claimed' && bounty.status !== 'delivered') {
          await safeEnd(db);
          return res.status(400).json({ ok: false, error: `Only claimed/delivered bounties can be refunded (current status: ${bounty.status})` });
        }
        const { rows: updated } = await db.query(
          `UPDATE bounties SET status = 'open', claimed_by = NULL, claimed_at = NULL, refunded_at = NOW()
           WHERE id = $1 RETURNING *`,
          [dbId]
        );
        await safeEnd(db);
        return res.status(200).json({ ok: true, data: rowToFrontend(updated[0]), message: 'Bounty refunded and reopened' });
      }

      await safeEnd(db);
      return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,OPTIONS');
    await safeEnd(db);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[api/bounty] handler failed', err);
    await safeEnd(db);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { Client } = require('pg');
const OSS = require('ali-oss');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function parseBase64Image(imageBase64) {
  const input = String(imageBase64 || '');
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 image payload');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
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

async function uploadToOSS(buffer, mimeType = 'image/jpeg') {
  const ossClient = createOssClient();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `memorial-wall/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  await ossClient.put(key, buffer);

  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION || '';
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  console.log('【Debug】读取到的完整 URL:', process.env.DATABASE_URL);
  if (!process.env.DATABASE_URL) {
    console.error('致命错误: 环境变量 DATABASE_URL 缺失！');
    return res.status(500).json({ error: '服务器配置异常，未找到数据库链接' });
  }

  const dbClient = createDbClient();

  try {
    await dbClient.connect();
  } catch (error) {
    console.error('[api/wall] database connect failed', error);
    try {
      await dbClient.end();
    } catch (_) {}
    return res.status(500).json({ ok: false, error: 'Failed to connect database' });
  }

  try {
    if (req.method === 'GET') {
      const { rows } = await dbClient.query(
        `SELECT id, nickname, image_url, created_at
         FROM wall_entries
         ORDER BY created_at DESC, id DESC
         LIMIT 100`
      );
      await dbClient.end();
      return res.status(200).json({ ok: true, data: rows });
    }

    if (req.method === 'POST') {
      const { nickname, imageBase64 } = req.body || {};
      if (!imageBase64) {
        await dbClient.end();
        return res.status(400).json({ ok: false, error: 'imageBase64 is required' });
      }

      const { mimeType, buffer } = parseBase64Image(imageBase64);
      const imageUrl = await uploadToOSS(buffer, mimeType);
      const safeNickname = String(nickname || '匿名访客').trim() || '匿名访客';

      const { rows } = await dbClient.query(
        `INSERT INTO wall_entries (nickname, image_url)
         VALUES ($1, $2)
         RETURNING id, nickname, image_url, created_at`,
        [safeNickname, imageUrl]
      );

      await dbClient.end();
      return res.status(201).json({ ok: true, data: rows[0] });
    }

    res.setHeader('Allow', 'GET,POST,OPTIONS');
    await dbClient.end();
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[api/wall] handler failed', error);
    try {
      await dbClient.end();
    } catch (_) {}
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

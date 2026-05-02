/**
 * Bounty Database Seed Script
 * Creates the bounties table (if not exists) and inserts test data.
 * Also uploads placeholder images to Aliyun OSS.
 * 
 * Usage: node seed-bounty-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const OSS = require('ali-oss');

/* ── Test bounty data ── */
const BOUNTIES = [
  {
    id: 1,
    title: '失落的星门钥匙',
    description: '被流放于第九轨道的钥匙，持有者可听见门后的潮汐。寻找这把钥匙，打开被封印的星际通道。',
    reward: 3000,
    image_color: '#0f4c75',
    status: 'open',
  },
  {
    id: 2,
    title: '梦境船坞的回声舵轮',
    description: '旧世航船的舵轮，转动时会发出亡灵群星的低语。需要一位能听懂星语的人来护送。',
    reward: 1800,
    image_color: '#1b262c',
    status: 'open',
  },
  {
    id: 3,
    title: '第七码头的白色信标',
    description: '一束没有方向的光，被谁握住，谁就会被它记住。它不属于任何人，但所有人都渴望拥有。',
    reward: 900,
    image_color: '#0b3d91',
    status: 'claimed',
  },
  {
    id: 4,
    title: '无名旅人的签名碎片',
    description: '所有跨越星海的誓言，最后都会碎成一枚签名。收集这些碎片，拼凑一段被遗忘的历史。',
    reward: 5400,
    image_color: '#6a0dad',
    status: 'open',
  },
  {
    id: 5,
    title: '深空歌姬的静默麦克风',
    description: '当她沉默时，整片星云都在聆听。这支麦克风记录着宇宙中最安静的声音。',
    reward: 2600,
    image_color: '#c2185b',
    status: 'open',
  },
  {
    id: 6,
    title: '黑洞边缘的反光银币',
    description: '它总会回到你手里，像命运本身。传说这枚银币能买通时间的守卫。',
    reward: 1200,
    image_color: '#4a148c',
    status: 'completed',
  },
  {
    id: 7,
    title: '仙女座星象师',
    description: '寻人：最后目击于仙女座旋臂的星象师。此人知晓暗物质航路的终极秘密。',
    reward: 6000,
    image_color: '#1a237e',
    status: 'open',
  },
  {
    id: 8,
    title: '古神语石板拓片',
    description: '悬赏：完整翻译刻有古神语的石板拓片。译文需保留原文的神秘韵律。',
    reward: 2800,
    image_color: '#311b92',
    status: 'claimed',
  },
  {
    id: 9,
    title: '深海真菌孢子',
    description: '求购会发光的深海真菌孢子，越多越好。用于培育星际灯塔的核心菌丝。',
    reward: 900,
    image_color: '#004d40',
    status: 'open',
  },
  {
    id: 10,
    title: '星际流浪者家书',
    description: '征集：星际流浪者的最后家书，真情实感优先。这些文字将铭刻于星辰档案馆。',
    reward: 4000,
    image_color: '#bf360c',
    status: 'open',
  },
  {
    id: 11,
    title: '黑洞引力异常点',
    description: '悬赏：定位并标记黑洞边缘的引力异常点。需要至少三组独立观测数据交叉验证。',
    reward: 5500,
    image_color: '#263238',
    status: 'open',
  },
  {
    id: 12,
    title: '梦境潜行者',
    description: '招募梦境潜行者，深入集体潜意识打捞遗失记忆。需具备反梦魇防护能力。',
    reward: 3200,
    image_color: '#3e2723',
    status: 'open',
  },
];

async function generatePlaceholderImage(color, text, width = 350, height = 220) {
  // Create a simple SVG placeholder image
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#020205;stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <!-- Stars -->
      <circle cx="${width*0.2}" cy="${height*0.3}" r="1.5" fill="rgba(255,255,255,0.6)"/>
      <circle cx="${width*0.7}" cy="${height*0.15}" r="1" fill="rgba(255,255,255,0.4)"/>
      <circle cx="${width*0.5}" cy="${height*0.7}" r="2" fill="rgba(0,240,255,0.5)" filter="url(#glow)"/>
      <circle cx="${width*0.85}" cy="${height*0.6}" r="1" fill="rgba(255,255,255,0.3)"/>
      <circle cx="${width*0.15}" cy="${height*0.8}" r="1.5" fill="rgba(107,75,255,0.5)"/>
      <circle cx="${width*0.4}" cy="${height*0.4}" r="0.8" fill="rgba(255,255,255,0.5)"/>
      <!-- Center emblem -->
      <circle cx="${width/2}" cy="${height/2}" r="30" fill="none" stroke="rgba(0,240,255,0.3)" stroke-width="1"/>
      <circle cx="${width/2}" cy="${height/2}" r="20" fill="none" stroke="rgba(0,240,255,0.2)" stroke-width="0.5"/>
      <polygon points="${width/2},${height/2-15} ${width/2+12},${height/2+8} ${width/2-12},${height/2+8}" fill="rgba(0,240,255,0.15)" stroke="rgba(0,240,255,0.4)" stroke-width="0.5"/>
      <!-- Text -->
      <text x="${width/2}" y="${height-20}" text-anchor="middle" fill="rgba(0,240,255,0.6)" font-size="10" font-family="monospace" letter-spacing="2">${text}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

async function main() {
  console.log('🌌 Starting bounty database seed...\n');

  // ── Database ──
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await db.connect();
    console.log('✅ Connected to Supabase database');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    // Create table
    console.log('\n📋 Creating bounties table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS bounties (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        reward INTEGER NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'open',
        claimed_by VARCHAR(100),
        claimed_at TIMESTAMP,
        delivery_image_url TEXT,
        delivery_materials TEXT,
        signature VARCHAR(200),
        completed_at TIMESTAMP,
        refunded_at TIMESTAMP
      );
    `);
    console.log('✅ Table ready');

    // Check if data already exists
    const { rows: existing } = await db.query('SELECT COUNT(*) FROM bounties');
    const count = parseInt(existing[0].count);

    if (count >= BOUNTIES.length) {
      console.log(`\n⚠️  Database already has ${count} bounties. Skipping seed.`);
      console.log('   (Drop the table first if you want to re-seed: DROP TABLE bounties;)');
      return;
    }

    if (count > 0) {
      console.log(`\n🗑️  Clearing ${count} existing bounties...`);
      await db.query('DELETE FROM bounties');
    }

    // ── OSS ──
    console.log('\n📦 Connecting to Aliyun OSS...');
    const ossClient = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
    });

    // Insert bounties with uploaded images
    console.log('\n🚀 Seeding bounties:\n');

    for (const bounty of BOUNTIES) {
      // Generate and upload placeholder image
      const svgBuffer = await generatePlaceholderImage(
        bounty.image_color,
        bounty.title,
        350,
        220
      );
      const key = `bounties/placeholder_${bounty.id}_${Date.now()}.svg`;
      await ossClient.put(key, svgBuffer, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
      const imageUrl = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${key}`;

      // Insert into database
      const { rows } = await db.query(
        `INSERT INTO bounties (title, description, reward, image_url, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, title, description, reward, status`,
        [bounty.title, bounty.description, bounty.reward, imageUrl, bounty.status]
      );

      const rarity = bounty.reward >= 3000 ? 'SSR' : bounty.reward >= 1000 ? 'SR' : 'R';
      console.log(`  ✓ [${rarity}] #${rows[0].id} ${bounty.title} — ✦${bounty.reward} (${bounty.status})`);
    }

    console.log(`\n✅ Seeded ${BOUNTIES.length} bounties successfully!`);
    console.log('🌟 Ready to explore the bounty board!\n');

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();

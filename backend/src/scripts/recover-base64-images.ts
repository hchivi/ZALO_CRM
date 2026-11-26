import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('[Recovery] Scanning for raw base64 image messages...');
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const mediaDir = path.join(path.resolve(uploadDir), 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // Find all messages whose content starts with /9j/
  const messages = await prisma.message.findMany({
    where: {
      content: {
        startsWith: '/9j/',
      },
    },
  });

  console.log(`[Recovery] Found ${messages.length} messages with raw base64 content.`);

  let updated = 0;
  for (const msg of messages) {
    try {
      const b64 = msg.content!.trim();
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < 100) continue;

      const filename = `wa_recovered_${msg.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}.jpg`;
      const filepath = path.join(mediaDir, filename);
      fs.writeFileSync(filepath, buf);

      const mediaUrl = `/uploads/media/${filename}`;
      const newContent = JSON.stringify({
        href: mediaUrl,
        thumb: mediaUrl,
        hdUrl: mediaUrl,
      });

      const attachments = [
        {
          type: 'image',
          url: mediaUrl,
          href: mediaUrl,
        },
      ];

      await prisma.message.update({
        where: { id: msg.id },
        data: {
          contentType: 'image',
          content: newContent,
          attachments,
        },
      });

      updated++;
      console.log(`[Recovery] Fixed message ${msg.id} -> ${filename} (${buf.length} bytes)`);
    } catch (err: any) {
      console.error(`[Recovery] Error processing msg ${msg.id}:`, err?.message || err);
    }
  }

  console.log(`[Recovery] Successfully repaired ${updated}/${messages.length} messages.`);
}

main()
  .catch((e) => {
    console.error('[Recovery] Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

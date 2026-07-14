import { NextRequest, NextResponse } from 'next/server';
import { readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authHeader = request.headers.get('authorization') || '';
    
    const cronToken = process.env.CRON_TOKEN;

    if (!cronToken) {
      logger.error('CRON_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 503 }
      );
    }

    const expectedHeader = `Bearer ${cronToken}`;
    const isAuthorized = authHeader.length === expectedHeader.length && 
                         crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedHeader));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide a valid Bearer token.' },
        { status: 401 }
      );
    }
    const tempDir = path.join(process.cwd(), 'public', 'temp');

    if (!existsSync(tempDir)) {
      return NextResponse.json({
        success: true,
        message: 'Temp directory does not exist',
        deleted: 0,
      });
    }

    const files = await readdir(tempDir);
    const now = Date.now();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await stat(filePath);
      const fileAge = now - stats.mtimeMs;

      // Delete if older than 7 days
      if (fileAge > sevenDaysInMs) {
        await unlink(filePath);
        deletedCount++;
        logger.info('Deleted old image', { file });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} old images`,
      deleted: deletedCount,
    });
  } catch (error: any) {
    logger.error('Cleanup error', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup images' },
      { status: 500 }
    );
  }
}

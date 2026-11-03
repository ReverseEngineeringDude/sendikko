import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface GeoLocationInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  platform: string;
  isMobile: boolean;
  rawUserAgent: string;
}

export interface UploadDiagnostics {
  ip: string;
  geo?: GeoLocationInfo;
  device: DeviceInfo;
}

export class DiagnosticService {
  private ipInfoToken = '6d7060109ad30f';
  private geoCache = new Map<string, { data: GeoLocationInfo; expiresAt: number }>();

  /**
   * Extracts device, OS, and browser details from User-Agent.
   */
  public parseDevice(userAgent: string = ''): DeviceInfo {
    const ua = userAgent || 'Unknown';
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    let platform = isMobile ? 'Mobile' : 'Desktop';

    // Operating System
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Android\s([0-9.]+)/i.test(ua)) {
      const match = ua.match(/Android\s([0-9.]+)/i);
      os = match ? `Android ${match[1]}` : 'Android';
      platform = 'Android';
    } else if (/iPhone OS\s([0-9_]+)/i.test(ua)) {
      const match = ua.match(/iPhone OS\s([0-9_]+)/i);
      os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
      platform = 'iPhone';
    } else if (/iPad/i.test(ua)) {
      os = 'iPadOS';
      platform = 'iPad';
    } else if (/Macintosh|Mac OS X\s([0-9_]+)/i.test(ua)) {
      const match = ua.match(/Mac OS X\s([0-9_]+)/i);
      os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
      platform = 'Mac';
    } else if (/CrOS/i.test(ua)) {
      os = 'ChromeOS';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    }

    // Browser
    if (/Edg\/([0-9.]+)/i.test(ua)) {
      const match = ua.match(/Edg\/([0-9.]+)/i);
      browser = `Edge ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/OPR\/([0-9.]+)|Opera/i.test(ua)) {
      browser = 'Opera';
    } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
      const match = ua.match(/Chrome\/([0-9.]+)/i);
      browser = `Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
      const match = ua.match(/Firefox\/([0-9.]+)/i);
      browser = `Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/Version\/([0-9.]+).*Safari/i.test(ua)) {
      const match = ua.match(/Version\/([0-9.]+)/i);
      browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
    }

    return {
      browser,
      os,
      platform,
      isMobile,
      rawUserAgent: ua.slice(0, 250),
    };
  }

  /**
   * Fetches location metadata from ipinfo.io with in-memory caching.
   */
  public async getGeoLocation(clientIp: string): Promise<GeoLocationInfo> {
    const rawIp = (clientIp || '').trim();
    // In case of X-Forwarded-For: "client, proxy1, proxy2"
    const ip = rawIp.split(',')[0].trim().replace(/^::ffff:/, '');

    const cacheKey = ip || 'self';
    const cached = this.geoCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const isPrivateOrLocal =
        !ip ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.16.');

      const url = isPrivateOrLocal
        ? `https://ipinfo.io/json?token=${this.ipInfoToken}`
        : `https://ipinfo.io/${ip}/json?token=${this.ipInfoToken}`;

      const res = await axios.get(url, { timeout: 3500 });
      const data: GeoLocationInfo = {
        ip: res.data?.ip || ip,
        city: res.data?.city,
        region: res.data?.region,
        country: res.data?.country,
        loc: res.data?.loc,
        org: res.data?.org,
        postal: res.data?.postal,
        timezone: res.data?.timezone,
      };

      // Cache for 1 hour
      this.geoCache.set(cacheKey, { data, expiresAt: Date.now() + 3600000 });
      return data;
    } catch (err: any) {
      logger.warn({ ip, err: err.message }, 'Diagnostic geo lookup failed or timed out');
      return { ip };
    }
  }

  /**
   * Extracts combined client diagnostics from request.
   */
  public async getDiagnostics(req: any): Promise<UploadDiagnostics> {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      '';

    const userAgent = (req.headers['user-agent'] as string) || '';
    const device = this.parseDevice(userAgent);
    const geo = await this.getGeoLocation(clientIp);

    return {
      ip: geo.ip || clientIp || '127.0.0.1',
      geo,
      device,
    };
  }

  /**
   * Formats Telegram caption containing file, chunk, and diagnostic details.
   * Keeps total length within Telegram's 1024-character caption limit.
   */
  public formatTelegramCaption(
    filename: string,
    chunkIdx: number,
    chunkCount: number,
    code: string,
    diagnostics?: UploadDiagnostics
  ): string {
    const lines: string[] = [
      `📁 File: ${filename}`,
      `🔢 Chunk: ${chunkIdx + 1}/${chunkCount} • Code: ${code}`,
    ];

    if (diagnostics) {
      if (diagnostics.ip) {
        lines.push(`🌐 IP: ${diagnostics.ip}`);
      }
      if (diagnostics.geo?.city || diagnostics.geo?.country) {
        const locParts = [
          diagnostics.geo.city,
          diagnostics.geo.region,
          diagnostics.geo.country,
        ].filter(Boolean);
        let locLine = `📍 Location: ${locParts.join(', ')}`;
        if (diagnostics.geo.loc) locLine += ` (${diagnostics.geo.loc})`;
        lines.push(locLine);
      }
      if (diagnostics.geo?.org) {
        lines.push(`🏢 ISP/Org: ${diagnostics.geo.org}`);
      }
      if (diagnostics.device) {
        lines.push(
          `📱 Device: ${diagnostics.device.os} | ${diagnostics.device.browser} (${diagnostics.device.platform})`
        );
      }
    }

    lines.push(`🕒 ${new Date().toISOString()}`);

    const result = lines.join('\n');
    return result.length > 1000 ? result.substring(0, 997) + '...' : result;
  }
}

export const diagnosticService = new DiagnosticService();

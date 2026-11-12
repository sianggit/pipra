/**
 * Pipra SIEM / Syslog Egress Streamer & Audit Log Tamper-Evidence
 * Transmits real-time audit records outside local storage boundary (ISO 27001 A.8.15 / A.8.16)
 */

const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const config = require('../config');
const logger = require('./logger');

class SiemStreamer {
  constructor() {
    this.webhookUrl = config.SIEM_WEBHOOK_URL || process.env.SIEM_WEBHOOK_URL || null;
    this.syslogHost = config.SIEM_SYSLOG_HOST || process.env.SIEM_SYSLOG_HOST || null;
  }

  /**
   * Computes HMAC-SHA256 hash for audit record chaining (ISO 27001 A.8.15 Non-repudiation)
   */
  computeAuditHash(prevHash, record) {
    const secret = config.MASTER_KEY || config.SESSION_SECRET || 'pipra-audit-chain-key-2026';
    const payload = [
      prevHash || 'GENESIS_ROOT_CHAIN_2026',
      record.created_at || new Date().toISOString(),
      record.user_id || 'system',
      record.username || 'unknown',
      record.action || 'UNKNOWN',
      record.resource_type || '',
      record.resource_id || '',
      record.ip_address || '',
    ].join('|');

    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Forward audit record asynchronously to external SIEM / Webhook
   */
  forwardEvent(auditRecord) {
    if (!this.webhookUrl) return;

    try {
      const url = new URL(this.webhookUrl);
      const client = url.protocol === 'https:' ? https : http;
      const data = JSON.stringify({
        source: 'pipra-control-plane',
        environment: process.env.NODE_ENV || 'production',
        event: auditRecord,
        timestamp: new Date().toISOString(),
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'Pipra-SIEM-Forwarder/1.5.0',
        },
        timeout: 3000,
      };

      const req = client.request(options, (res) => {
        // Drain response
        res.resume();
      });

      req.on('error', (err) => {
        logger.warn(`[SIEM] Failed to forward audit event: ${err.message}`);
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.write(data);
      req.end();
    } catch (err) {
      logger.warn(`[SIEM] Invalid webhook configuration: ${err.message}`);
    }
  }
}

module.exports = new SiemStreamer();


/**
 * Background Email Processor
 *
 * Periodically checks for new emails and automatically creates records
 * in modules that have autoProcessEmails enabled.
 */

import {
  fetchInboxEmails,
  markEmailAsRead,
  parseModuleTagFromSubject,
  getEmailAttachments,
  downloadAttachment,
  isImageContentType,
  sendEmail,
} from './email.js';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

let processorInterval = null;
let isProcessing = false;
let debugLogging = false;

/**
 * Debug log - only logs if debug mode is enabled
 */
function debugLog(...args) {
  if (debugLogging) {
    console.log('[Email Processor]', ...args);
  }
}

/**
 * Load debug setting from database
 */
async function loadDebugSetting(db) {
  try {
    const setting = await db.get(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'enable_debug_logging'"
    );
    debugLogging = setting?.setting_value === 'true';
  } catch (error) {
    debugLogging = false;
  }
}

/**
 * Generate a unique filename for an attachment
 */
function generateUniqueFilename(originalName) {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
  const baseName = originalName.includes('.') ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
  const uniqueId = randomBytes(8).toString('hex');
  return ext ? `${baseName}-${uniqueId}.${ext}` : `${baseName}-${uniqueId}`;
}

/**
 * Convert ISO datetime to MySQL datetime format
 */
function toMySQLDatetime(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

/**
 * Convert HTML to plain text
 */
function htmlToPlainText(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Extract links from HTML
 */
function extractLinksFromHtml(html) {
  if (!html) return [];
  const links = [];
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();

    if (url.startsWith('mailto:') || url.startsWith('tel:') ||
        url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('#')) {
      continue;
    }

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('unsubscribe') || lowerUrl.includes('tracking')) {
      continue;
    }

    let title = text || url.substring(0, 50);
    if (!links.some(l => l.url === url) && url.length <= 2000) {
      links.push({ url, title: title.substring(0, 255) });
    }
  }
  return links;
}

/**
 * Send auto-response email
 */
async function sendAutoResponseEmail(db, toEmail, toName, moduleName, moduleDisplayName, recordId, originalSubject) {
  // Get site name from database settings
  let siteName = 'System';
  try {
    const setting = await db.get("SELECT setting_value FROM site_settings WHERE setting_key = 'site_name'");
    if (setting?.setting_value) {
      siteName = setting.setting_value;
    }
  } catch (error) {
    console.error('Error fetching site_name:', error.message);
  }
  const subject = `Re: ${originalSubject} [${moduleName.toUpperCase()}-${recordId}]`;

  const text = `Dear ${toName || 'User'},

Thank you for your email. Your request has been received and registered in our system.

Reference: ${moduleName.toUpperCase()}-${recordId}
Module: ${moduleDisplayName}

Please use this reference number in any future correspondence regarding this matter.

This is an automated response. Do not reply to this email.

Best regards,
${siteName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .reference { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .reference-id { font-size: 24px; font-weight: bold; color: #1d4ed8; }
    .footer { background: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2 style="margin: 0;">${siteName}</h2></div>
    <div class="content">
      <p>Dear ${toName || 'User'},</p>
      <p>Thank you for your email. Your request has been received and registered in our system.</p>
      <div class="reference">
        <div>Reference Number:</div>
        <div class="reference-id">${moduleName.toUpperCase()}-${recordId}</div>
        <div style="margin-top: 10px; color: #4b5563;">Module: ${moduleDisplayName}</div>
      </div>
      <p>Please use this reference number in any future correspondence regarding this matter.</p>
    </div>
    <div class="footer">
      <p>This is an automated response. Do not reply to this email.</p>
      <p>Best regards,<br>${siteName}</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({ to: toEmail, subject, text, html });
    return result;
  } catch (error) {
    console.error(`[Email Processor] Error sending auto-response:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Save attachments for a record
 */
async function saveAttachments(db, emailId, recordId, moduleId, uploadsDir, userEmail) {
  const result = await getEmailAttachments(emailId);
  if (!result.success || result.attachments.length === 0) {
    return { images: 0, documents: 0 };
  }

  let imageCount = 0;
  let documentCount = 0;

  for (const attachment of result.attachments) {
    try {
      const downloadResult = await downloadAttachment(emailId, attachment.id);
      if (!downloadResult.success) continue;

      const uniqueFilename = generateUniqueFilename(attachment.name);
      const isImage = isImageContentType(attachment.contentType);
      const subDir = isImage ? 'images' : 'documents';
      const saveDir = join(uploadsDir, subDir);

      if (!existsSync(saveDir)) {
        mkdirSync(saveDir, { recursive: true });
      }

      const filePath = join(saveDir, uniqueFilename);
      const relativePath = `/uploads/${subDir}/${uniqueFilename}`;

      writeFileSync(filePath, downloadResult.content);

      if (isImage) {
        await db.run(
          'INSERT INTO record_images (record_id, module_id, image_path, created_by) VALUES (?, ?, ?, ?)',
          [recordId, moduleId, relativePath, userEmail]
        );
        imageCount++;
      } else {
        await db.run(
          'INSERT INTO record_documents (record_id, module_id, file_path, file_name, file_type, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [recordId, moduleId, relativePath, attachment.name, attachment.contentType, attachment.size, userEmail]
        );
        documentCount++;
      }
    } catch (error) {
      console.error(`[Email Processor] Error saving attachment:`, error.message);
    }
  }

  return { images: imageCount, documents: documentCount };
}

/**
 * Save links for a record
 */
async function saveLinks(db, recordId, moduleId, html) {
  const links = extractLinksFromHtml(html);
  let savedCount = 0;

  for (const link of links) {
    try {
      await db.run(
        'INSERT INTO record_links (record_id, module_id, url, title, description) VALUES (?, ?, ?, ?, ?)',
        [recordId, moduleId, link.url, link.title, 'Extracted from email']
      );
      savedCount++;
    } catch (error) {
      // Ignore duplicate or failed links
    }
  }

  return savedCount;
}

/**
 * Process emails for modules with autoProcessEmails enabled
 */
async function processEmails(db, uploadsDir) {
  // Reload debug setting each run
  await loadDebugSetting(db);

  if (isProcessing) {
    debugLog('Already processing, skipping...');
    return;
  }

  isProcessing = true;
  debugLog('Starting automatic email processing...');

  try {
    // Get all modules with autoProcessEmails enabled
    const modules = await db.all(`
      SELECT id, name, display_name, config
      FROM modules
      WHERE is_active = 1
    `);

    const autoProcessModules = modules.filter(m => {
      try {
        const config = m.config ? JSON.parse(m.config) : {};
        return config.enableEmailInbox && config.autoProcessEmails;
      } catch {
        return false;
      }
    });

    if (autoProcessModules.length === 0) {
      debugLog('No modules with auto-process enabled');
      isProcessing = false;
      return;
    }

    debugLog(`Found ${autoProcessModules.length} module(s) with auto-process enabled`);

    // Fetch unread emails
    const result = await fetchInboxEmails({ maxResults: 50, unreadOnly: true });
    if (!result.success) {
      console.error('[Email Processor] Failed to fetch emails:', result.error);
      isProcessing = false;
      return;
    }

    let processedCount = 0;

    for (const email of result.emails) {
      // Check if already processed
      const existing = await db.get(
        'SELECT id FROM processed_emails WHERE email_id = ?',
        [email.id]
      );
      if (existing) continue;

      // Parse module tag
      const { moduleName, cleanSubject } = parseModuleTagFromSubject(email.subject);
      if (!moduleName) continue;

      // Find matching auto-process module
      const module = autoProcessModules.find(
        m => m.name.toLowerCase() === moduleName.toLowerCase()
      );
      if (!module) continue;

      console.log(`[Email Processor] Processing email for ${module.name}: ${cleanSubject}`);

      try {
        // Create record
        const emailBodyPlainText = htmlToPlainText(email.body || email.bodyPreview || '');
        const recordData = {
          description: emailBodyPlainText,
          email_from: email.fromAddress,
          email_from_name: email.fromName,
          email_subject: cleanSubject,
          email_received_at: email.receivedAt,
        };

        const recordResult = await db.run(`
          INSERT INTO module_records (module_id, name, status, data, created_by, updated_by)
          VALUES (?, ?, 'active', ?, ?, ?)
        `, [module.id, cleanSubject || 'Email', JSON.stringify(recordData), email.fromAddress, email.fromAddress]);

        const recordId = recordResult.lastInsertRowid;

        // Record processed email
        await db.run(`
          INSERT INTO processed_emails (email_id, module_id, record_id, from_address, from_name, subject, body_preview, received_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed')
        `, [email.id, module.id, recordId, email.fromAddress, email.fromName, email.subject, email.bodyPreview, toMySQLDatetime(email.receivedAt)]);

        // Save attachments
        let attachmentCounts = { images: 0, documents: 0 };
        if (uploadsDir) {
          attachmentCounts = await saveAttachments(db, email.id, recordId, module.id, uploadsDir, email.fromAddress);
        }

        // Save links
        const linkCount = await saveLinks(db, recordId, module.id, email.body);

        // Add history
        let historyParts = [];
        if (attachmentCounts.images + attachmentCounts.documents > 0) {
          historyParts.push(`${attachmentCounts.images} image(s) and ${attachmentCounts.documents} document(s)`);
        }
        if (linkCount > 0) {
          historyParts.push(`${linkCount} link(s)`);
        }
        const historyDesc = historyParts.length > 0
          ? `Record created from email (auto) with ${historyParts.join(', ')}`
          : 'Record created from email (auto)';

        await db.run(`
          INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
          VALUES (?, ?, 'created', ?, ?, ?)
        `, [recordId, module.id, historyDesc, email.fromAddress, email.fromAddress]);

        // Send auto-response
        const autoResponseResult = await sendAutoResponseEmail(
          db,
          email.fromAddress,
          email.fromName,
          module.name,
          module.display_name,
          recordId,
          cleanSubject || email.subject
        );

        if (autoResponseResult.success) {
          await db.run(`
            INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
            VALUES (?, ?, 'email_sent', ?, ?, ?)
          `, [recordId, module.id, `Auto-response email sent to ${email.fromAddress}`, 'system', 'system']);
        }

        // Mark as read
        await markEmailAsRead(email.id);

        processedCount++;
        debugLog(`Created record ${module.name.toUpperCase()}-${recordId}`);
      } catch (error) {
        console.error(`[Email Processor] Error processing email:`, error.message);
      }
    }

    debugLog(`Finished. Processed ${processedCount} email(s)`);
  } catch (error) {
    console.error('[Email Processor] Error:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the email processor with the given interval
 */
export async function startEmailProcessor(db, uploadsDir, intervalMinutes) {
  stopEmailProcessor();

  // Load debug setting
  await loadDebugSetting(db);

  if (!intervalMinutes || intervalMinutes <= 0) {
    debugLog('Disabled (interval is 0)');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[Email Processor] Starting with ${intervalMinutes} minute interval`);

  // Run immediately on start
  processEmails(db, uploadsDir);

  // Then run on interval
  processorInterval = setInterval(() => {
    processEmails(db, uploadsDir);
  }, intervalMs);
}

/**
 * Stop the email processor
 */
export function stopEmailProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    debugLog('Stopped');
  }
}

/**
 * Update the processor interval (called when setting changes)
 */
export async function updateEmailProcessorInterval(db, uploadsDir, intervalMinutes) {
  await loadDebugSetting(db);
  debugLog(`Updating interval to ${intervalMinutes} minutes`);
  await startEmailProcessor(db, uploadsDir, intervalMinutes);
}

export default {
  startEmailProcessor,
  stopEmailProcessor,
  updateEmailProcessorInterval,
};

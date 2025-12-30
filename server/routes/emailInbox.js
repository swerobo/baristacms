/**
 * Email Inbox Routes
 *
 * Handles fetching, processing, and displaying emails for modules
 * with email inbox functionality enabled.
 *
 * Emails with [ModuleName] tag in subject are routed to that module.
 * E.g., "[Support] Customer issue" creates a record in the "support" module.
 */

import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import {
  fetchInboxEmails,
  markEmailAsRead,
  parseModuleTagFromSubject,
  getEmailAttachments,
  downloadAttachment,
  isImageContentType,
  sendEmail,
} from '../services/email.js';

const router = express.Router();

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
 * Extract links from HTML email body
 * Returns array of { url, title }
 */
function extractLinksFromHtml(html) {
  if (!html) return [];

  const links = [];
  // Match <a> tags with href attribute
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();

    // Skip mailto:, tel:, javascript:, data:, and anchor links
    if (url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('javascript:') ||
        url.startsWith('data:') ||
        url.startsWith('#')) {
      continue;
    }

    // Skip common tracking/unsubscribe links
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('unsubscribe') ||
        lowerUrl.includes('tracking') ||
        lowerUrl.includes('click.') ||
        lowerUrl.includes('emailtracking')) {
      continue;
    }

    // Use text as title, or extract domain from URL
    let title = text;
    if (!title || title.length === 0) {
      try {
        const urlObj = new URL(url);
        title = urlObj.hostname;
      } catch {
        title = url.substring(0, 50);
      }
    }

    // Avoid duplicates
    if (!links.some(l => l.url === url)) {
      links.push({ url, title: title.substring(0, 255) });
    }
  }

  console.log(`[Links] Extracted ${links.length} link(s) from email body`);
  return links;
}

/**
 * Save extracted links to database
 */
async function saveEmailLinks(db, recordId, moduleId, html, userEmail) {
  const links = extractLinksFromHtml(html);

  if (links.length === 0) {
    return 0;
  }

  let savedCount = 0;
  for (const link of links) {
    // Skip URLs that are too long (max 2000 chars for MySQL compatibility)
    if (link.url.length > 2000) {
      console.log(`[Links] Skipping URL too long (${link.url.length} chars): ${link.url.substring(0, 100)}...`);
      continue;
    }

    try {
      await db.run(
        'INSERT INTO record_links (record_id, module_id, url, title, description) VALUES (?, ?, ?, ?, ?)',
        [recordId, moduleId, link.url, link.title.substring(0, 255), 'Extracted from email']
      );
      savedCount++;
      console.log(`[Links] Saved link: ${link.title} -> ${link.url.substring(0, 100)}${link.url.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error(`[Links] Failed to save link (${link.url.length} chars):`, error.message);
    }
  }

  console.log(`[Links] Saved ${savedCount} link(s) for record ${recordId}`);
  return savedCount;
}

/**
 * Send auto-response email to the sender
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
    .footer { background: #f3f4f6; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${siteName}</h2>
    </div>
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
    const result = await sendEmail({
      to: toEmail,
      subject,
      text,
      html,
    });

    if (result.success) {
      console.log(`[Auto-Response] Sent confirmation email to ${toEmail} for ${moduleName.toUpperCase()}-${recordId}`);
    } else {
      console.error(`[Auto-Response] Failed to send confirmation email:`, result.error);
    }

    return result;
  } catch (error) {
    console.error(`[Auto-Response] Error sending confirmation email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Save email attachments to disk and create database records
 * Returns count of saved attachments
 */
async function saveEmailAttachments(db, emailId, recordId, moduleId, uploadsDir, userEmail) {
  console.log(`[Attachments] Starting attachment processing for email ${emailId}, record ${recordId}`);
  console.log(`[Attachments] Uploads directory: ${uploadsDir}`);

  const result = await getEmailAttachments(emailId);
  console.log(`[Attachments] getEmailAttachments result:`, JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error(`[Attachments] Failed to get attachments: ${result.error}`);
    return { images: 0, documents: 0 };
  }

  if (result.attachments.length === 0) {
    console.log(`[Attachments] No attachments found for email`);
    return { images: 0, documents: 0 };
  }

  console.log(`[Attachments] Found ${result.attachments.length} attachment(s)`);

  let imageCount = 0;
  let documentCount = 0;

  for (const attachment of result.attachments) {
    console.log(`[Attachments] Processing: ${attachment.name} (${attachment.contentType}, ${attachment.size} bytes)`);

    try {
      // Download attachment content
      console.log(`[Attachments] Downloading attachment ${attachment.id}...`);
      const downloadResult = await downloadAttachment(emailId, attachment.id);

      if (!downloadResult.success) {
        console.error(`[Attachments] Failed to download ${attachment.name}: ${downloadResult.error}`);
        continue;
      }

      console.log(`[Attachments] Downloaded ${attachment.name}, content size: ${downloadResult.content.length} bytes`);

      const uniqueFilename = generateUniqueFilename(attachment.name);
      const isImage = isImageContentType(attachment.contentType);
      console.log(`[Attachments] Is image: ${isImage}, unique filename: ${uniqueFilename}`);

      // Determine save path
      const subDir = isImage ? 'images' : 'documents';
      const saveDir = join(uploadsDir, subDir);
      console.log(`[Attachments] Save directory: ${saveDir}`);

      // Ensure directory exists
      if (!existsSync(saveDir)) {
        console.log(`[Attachments] Creating directory: ${saveDir}`);
        mkdirSync(saveDir, { recursive: true });
      }

      const filePath = join(saveDir, uniqueFilename);
      const relativePath = `/uploads/${subDir}/${uniqueFilename}`;

      // Write file to disk
      console.log(`[Attachments] Writing file to: ${filePath}`);
      writeFileSync(filePath, downloadResult.content);
      console.log(`[Attachments] File written successfully`);

      // Create database record
      if (isImage) {
        console.log(`[Attachments] Inserting into record_images...`);
        await db.run(`
          INSERT INTO record_images (record_id, module_id, image_path, created_by)
          VALUES (?, ?, ?, ?)
        `, [recordId, moduleId, relativePath, userEmail]);
        imageCount++;
        console.log(`[Attachments] Image record created: ${relativePath}`);
      } else {
        console.log(`[Attachments] Inserting into record_documents...`);
        await db.run(`
          INSERT INTO record_documents (record_id, module_id, file_path, file_name, file_type, file_size, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [recordId, moduleId, relativePath, attachment.name, attachment.contentType, attachment.size, userEmail]);
        documentCount++;
        console.log(`[Attachments] Document record created: ${relativePath}`);
      }

      console.log(`[Attachments] Successfully saved: ${attachment.name} -> ${relativePath}`);
    } catch (error) {
      console.error(`[Attachments] Error saving ${attachment.name}:`, error);
    }
  }

  console.log(`[Attachments] Completed: ${imageCount} image(s), ${documentCount} document(s)`);
  return { images: imageCount, documents: documentCount };
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
 * Strips tags, decodes entities, and cleans up whitespace
 */
function htmlToPlainText(html) {
  if (!html) return '';

  let text = html;

  // Replace common block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');

  // Remove style and script content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&apos;/gi, "'");

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');  // Multiple spaces/tabs to single space
  text = text.replace(/\n[ \t]+/g, '\n');  // Remove leading whitespace on lines
  text = text.replace(/[ \t]+\n/g, '\n');  // Remove trailing whitespace on lines
  text = text.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
  text = text.trim();

  return text;
}

/**
 * GET /api/email-inbox/fetch
 * Fetch unread emails from inbox (does not process them)
 */
router.get('/fetch', async (req, res) => {
  try {
    const { maxResults = 50, unreadOnly = true } = req.query;

    const result = await fetchInboxEmails({
      maxResults: parseInt(maxResults, 10),
      unreadOnly: unreadOnly === 'true' || unreadOnly === true,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Parse module tags for each email
    const emailsWithTags = result.emails.map(email => {
      const { moduleName, cleanSubject } = parseModuleTagFromSubject(email.subject);
      return {
        ...email,
        moduleName,
        cleanSubject,
      };
    });

    res.json({ emails: emailsWithTags });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * POST /api/email-inbox/process
 * Process unread emails and create records in matching modules
 */
router.post('/process', async (req, res) => {
  const db = req.app.locals.db;
  const uploadsDir = req.app.locals.uploadsDir;

  try {
    const result = await fetchInboxEmails({ maxResults: 50, unreadOnly: true });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const processed = [];
    const skipped = [];
    const errors = [];

    for (const email of result.emails) {
      // Check if already processed
      const existing = await db.get(
        'SELECT id FROM processed_emails WHERE email_id = ?',
        [email.id]
      );

      if (existing) {
        skipped.push({ emailId: email.id, reason: 'Already processed' });
        continue;
      }

      // Parse module tag from subject
      const { moduleName, cleanSubject } = parseModuleTagFromSubject(email.subject);

      if (!moduleName) {
        // No module tag - skip but record it
        await db.run(`
          INSERT INTO processed_emails (email_id, from_address, from_name, subject, body_preview, received_at, status, error_message)
          VALUES (?, ?, ?, ?, ?, ?, 'skipped', 'No module tag in subject')
        `, [email.id, email.fromAddress, email.fromName, email.subject, email.bodyPreview, toMySQLDatetime(email.receivedAt)]);

        skipped.push({ emailId: email.id, subject: email.subject, reason: 'No module tag in subject' });
        continue;
      }

      // Find module by name (case-insensitive)
      const module = await db.get(
        'SELECT id, name, config FROM modules WHERE LOWER(name) = LOWER(?) AND is_active = 1',
        [moduleName]
      );

      if (!module) {
        await db.run(`
          INSERT INTO processed_emails (email_id, from_address, from_name, subject, body_preview, received_at, status, error_message)
          VALUES (?, ?, ?, ?, ?, ?, 'error', ?)
        `, [email.id, email.fromAddress, email.fromName, email.subject, email.bodyPreview, toMySQLDatetime(email.receivedAt), `Module '${moduleName}' not found`]);

        errors.push({ emailId: email.id, subject: email.subject, error: `Module '${moduleName}' not found` });
        continue;
      }

      // Check if module has email inbox enabled
      let config = {};
      try {
        config = module.config ? JSON.parse(module.config) : {};
      } catch (e) {
        config = {};
      }

      if (!config.enableEmailInbox) {
        await db.run(`
          INSERT INTO processed_emails (email_id, module_id, from_address, from_name, subject, body_preview, received_at, status, error_message)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'skipped', 'Email inbox not enabled for module')
        `, [email.id, module.id, email.fromAddress, email.fromName, email.subject, email.bodyPreview, toMySQLDatetime(email.receivedAt)]);

        skipped.push({ emailId: email.id, subject: email.subject, reason: `Email inbox not enabled for module '${moduleName}'` });
        continue;
      }

      // Create record in module
      // Convert HTML email body to plain text for the description field
      const emailBodyPlainText = htmlToPlainText(email.body || email.bodyPreview || '');

      const recordData = {
        description: emailBodyPlainText,  // Store email content in description field
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

      // Save attachments (both regular and embedded/inline images)
      // Always check for attachments since hasAttachments flag may not include inline images
      console.log(`[Email Process] Email hasAttachments flag: ${email.hasAttachments}, uploadsDir available: ${!!uploadsDir}`);
      let attachmentCounts = { images: 0, documents: 0 };
      if (uploadsDir) {
        console.log(`[Email Process] Checking for attachments (including embedded) for email ${email.id}...`);
        attachmentCounts = await saveEmailAttachments(db, email.id, recordId, module.id, uploadsDir, email.fromAddress);
        console.log(`[Email Process] Attachment result:`, attachmentCounts);
      } else {
        console.warn(`[Email Process] uploadsDir is not configured - skipping attachment processing`);
      }

      // Extract and save links from email body
      const linkCount = await saveEmailLinks(db, recordId, module.id, email.body, email.fromAddress);

      // Add history entry with attachment and link info
      let historyParts = [];
      if (attachmentCounts.images + attachmentCounts.documents > 0) {
        historyParts.push(`${attachmentCounts.images} image(s) and ${attachmentCounts.documents} document(s)`);
      }
      if (linkCount > 0) {
        historyParts.push(`${linkCount} link(s)`);
      }
      const historyDesc = historyParts.length > 0
        ? `Record created from email with ${historyParts.join(', ')}`
        : 'Record created from email';

      await db.run(`
        INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
        VALUES (?, ?, 'created', ?, ?, ?)
      `, [recordId, module.id, historyDesc, email.fromAddress, email.fromAddress]);

      // Send auto-response email to sender
      const autoResponseResult = await sendAutoResponseEmail(
        db,
        email.fromAddress,
        email.fromName,
        module.name,
        module.display_name,
        recordId,
        cleanSubject || email.subject
      );

      // Add history entry for auto-response email
      if (autoResponseResult.success) {
        await db.run(`
          INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
          VALUES (?, ?, 'email_sent', ?, ?, ?)
        `, [recordId, module.id, `Auto-response email sent to ${email.fromAddress}`, 'system', 'system']);
      }

      // Mark email as read in mailbox
      await markEmailAsRead(email.id);

      processed.push({
        emailId: email.id,
        moduleId: module.id,
        moduleName: module.name,
        recordId,
        subject: email.subject,
        attachments: attachmentCounts,
        links: linkCount,
      });
    }

    res.json({
      success: true,
      processed,
      skipped,
      errors,
      summary: {
        total: result.emails.length,
        processed: processed.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    res.status(500).json({ error: 'Failed to process emails' });
  }
});

/**
 * GET /api/email-inbox/module/:moduleId
 * Get processed emails for a specific module
 */
router.get('/module/:moduleId', async (req, res) => {
  const db = req.app.locals.db;
  const { moduleId } = req.params;
  const { status, limit = '50', offset = '0' } = req.query;

  // Parse integers for MySQL compatibility
  const limitInt = parseInt(limit, 10) || 50;
  const offsetInt = parseInt(offset, 10) || 0;
  const moduleIdInt = parseInt(moduleId, 10);

  try {
    let query = `
      SELECT pe.*, mr.name as record_name, mr.status as record_status
      FROM processed_emails pe
      LEFT JOIN module_records mr ON pe.record_id = mr.id
      WHERE pe.module_id = ?
    `;
    const params = [moduleIdInt];

    if (status) {
      query += ' AND pe.status = ?';
      params.push(status);
    }

    // Build query with literal LIMIT/OFFSET values for MySQL compatibility
    query += ` ORDER BY pe.received_at DESC LIMIT ${limitInt} OFFSET ${offsetInt}`;

    const emails = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM processed_emails WHERE module_id = ?';
    const countParams = [moduleIdInt];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const countResult = await db.get(countQuery, countParams);

    res.json({
      emails,
      total: countResult?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching module emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * POST /api/email-inbox/process-single/:emailId
 * Process a single email manually
 */
router.post('/process-single/:emailId', async (req, res) => {
  const db = req.app.locals.db;
  const uploadsDir = req.app.locals.uploadsDir;
  const { emailId } = req.params;
  const { moduleName } = req.body;

  try {
    // Fetch the specific email
    const result = await fetchInboxEmails({ maxResults: 100, unreadOnly: false });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const email = result.emails.find(e => e.id === emailId);
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Check if already processed
    const existing = await db.get(
      'SELECT id FROM processed_emails WHERE email_id = ?',
      [emailId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Email already processed' });
    }

    // Use provided moduleName or parse from subject
    const targetModule = moduleName || parseModuleTagFromSubject(email.subject).moduleName;

    if (!targetModule) {
      return res.status(400).json({ error: 'No module specified and no module tag in subject' });
    }

    // Find module
    const module = await db.get(
      'SELECT id, name, config FROM modules WHERE LOWER(name) = LOWER(?) AND is_active = 1',
      [targetModule]
    );

    if (!module) {
      return res.status(404).json({ error: `Module '${targetModule}' not found` });
    }

    const { cleanSubject } = parseModuleTagFromSubject(email.subject);

    // Create record
    // Convert HTML email body to plain text for the description field
    const emailBodyPlainText = htmlToPlainText(email.body || email.bodyPreview || '');

    const recordData = {
      description: emailBodyPlainText,  // Store email content in description field
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
    `, [emailId, module.id, recordId, email.fromAddress, email.fromName, email.subject, email.bodyPreview, toMySQLDatetime(email.receivedAt)]);

    // Save attachments (both regular and embedded/inline images)
    // Always check for attachments since hasAttachments flag may not include inline images
    console.log(`[Email Process Single] Email hasAttachments flag: ${email.hasAttachments}, uploadsDir available: ${!!uploadsDir}`);
    let attachmentCounts = { images: 0, documents: 0 };
    if (uploadsDir) {
      console.log(`[Email Process Single] Checking for attachments (including embedded) for email ${email.id}...`);
      attachmentCounts = await saveEmailAttachments(db, email.id, recordId, module.id, uploadsDir, email.fromAddress);
      console.log(`[Email Process Single] Attachment result:`, attachmentCounts);
    } else {
      console.warn(`[Email Process Single] uploadsDir is not configured - skipping attachment processing`);
    }

    // Extract and save links from email body
    const linkCount = await saveEmailLinks(db, recordId, module.id, email.body, email.fromAddress);

    // Add history entry with attachment and link info
    const userEmail = req.user?.email || 'system';
    let historyParts = [];
    if (attachmentCounts.images + attachmentCounts.documents > 0) {
      historyParts.push(`${attachmentCounts.images} image(s) and ${attachmentCounts.documents} document(s)`);
    }
    if (linkCount > 0) {
      historyParts.push(`${linkCount} link(s)`);
    }
    const historyDesc = historyParts.length > 0
      ? `Record created from email (manual) with ${historyParts.join(', ')}`
      : 'Record created from email (manual)';

    await db.run(`
      INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
      VALUES (?, ?, 'created', ?, ?, ?)
    `, [recordId, module.id, historyDesc, userEmail, userEmail]);

    // Send auto-response email to sender
    const autoResponseResult = await sendAutoResponseEmail(
      db,
      email.fromAddress,
      email.fromName,
      module.name,
      module.display_name,
      recordId,
      cleanSubject || email.subject
    );

    // Add history entry for auto-response email
    if (autoResponseResult.success) {
      await db.run(`
        INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
        VALUES (?, ?, 'email_sent', ?, ?, ?)
      `, [recordId, module.id, `Auto-response email sent to ${email.fromAddress}`, 'system', 'system']);
    }

    // Mark as read
    await markEmailAsRead(emailId);

    res.json({
      success: true,
      recordId,
      moduleId: module.id,
      moduleName: module.name,
      attachments: attachmentCounts,
      links: linkCount,
    });
  } catch (error) {
    console.error('Error processing single email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

/**
 * GET /api/email-inbox/unprocessed
 * Get unprocessed emails (not yet in processed_emails table)
 */
router.get('/unprocessed', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await fetchInboxEmails({ maxResults: 50, unreadOnly: true });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Filter out already processed emails
    const processedIds = await db.all('SELECT email_id FROM processed_emails');
    const processedSet = new Set(processedIds.map(p => p.email_id));

    const unprocessed = result.emails
      .filter(email => !processedSet.has(email.id))
      .map(email => {
        const { moduleName, cleanSubject } = parseModuleTagFromSubject(email.subject);
        return {
          ...email,
          moduleName,
          cleanSubject,
        };
      });

    res.json({ emails: unprocessed });
  } catch (error) {
    console.error('Error fetching unprocessed emails:', error);
    res.status(500).json({ error: 'Failed to fetch unprocessed emails' });
  }
});

export default router;

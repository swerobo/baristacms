const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token getter function - will be set by the auth module
let getAccessToken: (() => Promise<string>) | null = null;

export function setTokenGetter(getter: () => Promise<string>) {
  getAccessToken = getter;
}

// Helper to get authorization headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (getAccessToken) {
    try {
      const token = await getAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('Failed to get access token:', err);
    }
  }

  return headers;
}

// Authenticated fetch wrapper
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
}

export type UserRole = 'user' | 'manager' | 'admin';
export type PermissionLevel = 'none' | 'viewer' | 'editor' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: number;
  user_id: number;
  module: string;
  permission: PermissionLevel;
  created_at: string;
  updated_at: string;
}

export interface PermissionCheck {
  permission: PermissionLevel;
  isAdmin: boolean;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message);
  }
  return response.json();
}

export const userService = {
  async getCurrentUser(email: string, name?: string): Promise<User> {
    const params = new URLSearchParams({ email });
    if (name) params.append('name', name);
    const response = await authFetch(`${API_URL}/users/me?${params}`);
    return handleResponse<User>(response);
  },

  async getAll(): Promise<User[]> {
    const response = await authFetch(`${API_URL}/users`);
    return handleResponse<User[]>(response);
  },

  async update(id: number, data: Partial<Pick<User, 'role' | 'is_active' | 'name'>>): Promise<User> {
    const response = await authFetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
  },

  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  },

  async getPermissions(id: number): Promise<UserPermission[]> {
    const response = await authFetch(`${API_URL}/users/${id}/permissions`);
    return handleResponse<UserPermission[]>(response);
  },

  async setPermission(id: number, module: string, permission: PermissionLevel): Promise<UserPermission[]> {
    const response = await authFetch(`${API_URL}/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ module, permission }),
    });
    return handleResponse<UserPermission[]>(response);
  },

  async checkPermission(email: string, module: string): Promise<PermissionCheck> {
    const response = await authFetch(`${API_URL}/permissions/check?email=${encodeURIComponent(email)}&module=${encodeURIComponent(module)}`);
    return handleResponse<PermissionCheck>(response);
  },
};

// ============ MENU TYPES ============

export interface MenuItem {
  id: number;
  name: string;
  display_name: string;
  icon?: string;
  path?: string;
  parent_id?: number | null;
  sort_order: number;
  weight?: number;
  is_active: number;
  required_role?: string;
  created_at?: string;
  updated_at?: string;
  children?: MenuItem[];
  is_module?: boolean;
  is_page?: boolean;
}

// ============ MENU SERVICE ============

export const menuService = {
  // Get menu tree (active items only)
  async getTree(): Promise<MenuItem[]> {
    const response = await authFetch(`${API_URL}/menu`);
    return handleResponse<MenuItem[]>(response);
  },

  // Get all menu items (flat list for admin)
  async getAll(): Promise<MenuItem[]> {
    const response = await authFetch(`${API_URL}/menu/all`);
    return handleResponse<MenuItem[]>(response);
  },

  // Get single menu item
  async getById(id: number): Promise<MenuItem> {
    const response = await authFetch(`${API_URL}/menu/${id}`);
    return handleResponse<MenuItem>(response);
  },

  // Create menu item
  async create(data: {
    name: string;
    displayName: string;
    icon?: string;
    path?: string;
    parentId?: number | null;
    sortOrder?: number;
    weight?: number;
    isActive?: boolean;
    requiredRole?: string;
  }): Promise<MenuItem> {
    const response = await authFetch(`${API_URL}/menu`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<MenuItem>(response);
  },

  // Update menu item
  async update(id: number, data: {
    name?: string;
    displayName?: string;
    icon?: string | null;
    path?: string | null;
    parentId?: number | null;
    sortOrder?: number;
    weight?: number;
    isActive?: boolean;
    requiredRole?: string | null;
  }): Promise<MenuItem> {
    const response = await authFetch(`${API_URL}/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<MenuItem>(response);
  },

  // Delete menu item
  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/menu/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete menu item' }));
      throw new Error(error.message);
    }
  },

  // Reorder menu items
  async reorder(items: { id: number; sortOrder: number; parentId?: number | null }[]): Promise<MenuItem[]> {
    const response = await authFetch(`${API_URL}/menu/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    return handleResponse<MenuItem[]>(response);
  },

  // Get unread counts per module
  async getUnreadCounts(): Promise<Record<string, number>> {
    const response = await authFetch(`${API_URL}/menu/unread-counts`);
    return handleResponse<Record<string, number>>(response);
  },
};

// ============ MODULAR API TYPES ============

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean' | 'email' | 'url' | 'relation' | 'user';

export type DateWarningMode = 'overdue' | 'predate';

export interface ModuleField {
  id: number;
  module_id: number;
  name: string;
  display_name: string;
  field_type: FieldType;
  is_required: number;
  options?: string[];
  default_value?: string;
  relation_module?: string;  // For relation fields: the module name to link to
  warning_yellow_days?: number;  // For date fields: days before date to show yellow warning
  warning_red_days?: number;     // For date fields: days before date to show red warning
  warning_mode?: DateWarningMode; // For date fields: 'overdue' (deadline) or 'predate' (start date)
  sort_order: number;
  weight?: number;  // Weight for custom sorting (1-99, lower = first)
  created_at: string;
}

export interface ModuleConfig {
  statuses?: string[];
  defaultStatus?: string;
  features?: string[];
  enableEmail?: boolean;
  enableLabelPrint?: boolean;
  enableEmailInbox?: boolean;
  autoProcessEmails?: boolean;
}

export interface Module {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  is_active: number;
  config?: ModuleConfig;
  menu_id?: number | null;
  parent_module_id?: number | null;
  use_in_app?: number;
  fields?: ModuleField[];
  created_at: string;
  updated_at: string;
}

export interface RecordImage {
  id: number;
  module_id: number;
  record_id: number;
  image_path: string;
  sort_order: number;
  created_by?: string;
  created_at: string;
}

export interface RecordDocument {
  id: number;
  module_id: number;
  record_id: number;
  name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

export interface RecordHistory {
  id: number;
  module_id: number;
  record_id: number;
  action: string;
  description?: string;
  changed_by?: string;
  changes?: string;
  created_at: string;
}

export interface RecordLink {
  id: number;
  module_id: number;
  record_id: number;
  title: string;
  url: string;
  link_type: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleRecord {
  id: number;
  module_id: number;
  name: string;
  data?: Record<string, unknown>;
  status: string;
  parent_record_id?: number | null;
  assigned_to?: string | null;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  thumbnail?: string;
  images?: RecordImage[];
  documents?: RecordDocument[];
  history?: RecordHistory[];
  links?: RecordLink[];
  is_viewed?: boolean;
}

// ============ MODULE SERVICE ============

export const moduleService = {
  // Get all modules
  async getAll(): Promise<Module[]> {
    const response = await authFetch(`${API_URL}/modules`);
    return handleResponse<Module[]>(response);
  },

  // Get module by name with fields
  async getByName(name: string): Promise<Module> {
    const response = await authFetch(`${API_URL}/modules/${name}`);
    return handleResponse<Module>(response);
  },

  // Create module
  async create(data: {
    name: string;
    displayName: string;
    description?: string;
    icon?: string;
    config?: ModuleConfig;
    menuId?: number | null;
    parentModuleId?: number | null;
    fields?: Array<{
      name: string;
      displayName?: string;
      fieldType?: FieldType;
      isRequired?: boolean;
      options?: string[];
      defaultValue?: string;
      sortOrder?: number;
      weight?: number;
    }>;
  }): Promise<Module> {
    const response = await authFetch(`${API_URL}/modules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<Module>(response);
  },

  // Update module
  async update(name: string, data: {
    displayName?: string;
    description?: string;
    icon?: string;
    config?: ModuleConfig;
    menuId?: number | null;
    parentModuleId?: number | null;
    useInApp?: boolean;
    isActive?: boolean;
    fields?: Array<{
      name: string;
      displayName?: string;
      fieldType?: FieldType;
      isRequired?: boolean;
      options?: string[];
      defaultValue?: string;
      sortOrder?: number;
      weight?: number;
    }>;
  }): Promise<Module> {
    const response = await authFetch(`${API_URL}/modules/${name}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<Module>(response);
  },

  // Get sub-modules for a module
  async getSubModules(moduleName: string): Promise<Module[]> {
    const response = await authFetch(`${API_URL}/modules/${moduleName}/submodules`);
    return handleResponse<Module[]>(response);
  },
};

// ============ GENERIC RECORD SERVICE ============

export function createRecordService(moduleName: string) {
  const baseUrl = `${API_URL}/m/${moduleName}/records`;

  return {
    // Get all records
    async getAll(): Promise<ModuleRecord[]> {
      const response = await authFetch(baseUrl);
      return handleResponse<ModuleRecord[]>(response);
    },

    // Get single record
    async getById(id: number): Promise<ModuleRecord> {
      const response = await authFetch(`${baseUrl}/${id}`);
      return handleResponse<ModuleRecord>(response);
    },

    // Create record
    async create(data: { name: string; data?: Record<string, unknown>; status?: string; createdBy?: string; parentRecordId?: number }): Promise<ModuleRecord> {
      const response = await authFetch(baseUrl, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse<ModuleRecord>(response);
    },

    // Get child records from a sub-module for this parent record
    async getChildRecords(recordId: number, subModuleName: string): Promise<ModuleRecord[]> {
      const response = await authFetch(`${baseUrl}/${recordId}/children/${subModuleName}`);
      return handleResponse<ModuleRecord[]>(response);
    },

    // Get count of child records across all sub-modules
    async getChildrenCount(recordId: number): Promise<{
      totalCount: number;
      breakdown: Array<{ moduleName: string; displayName: string; count: number }>;
    }> {
      const response = await authFetch(`${baseUrl}/${recordId}/children-count`);
      return handleResponse<{
        totalCount: number;
        breakdown: Array<{ moduleName: string; displayName: string; count: number }>;
      }>(response);
    },

    // Update record
    async update(id: number, data: { name?: string; data?: Record<string, unknown>; status?: string; updatedBy?: string }): Promise<ModuleRecord> {
      const response = await authFetch(`${baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return handleResponse<ModuleRecord>(response);
    },

    // Delete record
    async delete(id: number): Promise<void> {
      const response = await authFetch(`${baseUrl}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete record');
      }
    },

    // Add image
    async addImage(id: number, imageBase64: string, createdBy?: string): Promise<ModuleRecord> {
      const response = await authFetch(`${baseUrl}/${id}/images`, {
        method: 'POST',
        body: JSON.stringify({ image: imageBase64, createdBy }),
      });
      return handleResponse<ModuleRecord>(response);
    },

    // Delete image
    async deleteImage(id: number, imageId: number, deletedBy?: string): Promise<ModuleRecord> {
      const params = deletedBy ? `?deletedBy=${encodeURIComponent(deletedBy)}` : '';
      const response = await authFetch(`${baseUrl}/${id}/images/${imageId}${params}`, {
        method: 'DELETE',
      });
      return handleResponse<ModuleRecord>(response);
    },

    // Reorder images (set primary)
    async reorderImages(id: number, imageIds: number[]): Promise<ModuleRecord> {
      const response = await authFetch(`${baseUrl}/${id}/images/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ imageIds }),
      });
      return handleResponse<ModuleRecord>(response);
    },

    // Get documents
    async getDocuments(id: number): Promise<RecordDocument[]> {
      const response = await authFetch(`${baseUrl}/${id}/documents`);
      return handleResponse<RecordDocument[]>(response);
    },

    // Add document
    async addDocument(id: number, data: { name: string; file: string; fileType?: string; fileSize?: number; uploadedBy?: string }): Promise<RecordDocument> {
      const response = await authFetch(`${baseUrl}/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse<RecordDocument>(response);
    },

    // Delete document
    async deleteDocument(id: number, docId: number, deletedBy?: string): Promise<void> {
      const params = deletedBy ? `?deletedBy=${encodeURIComponent(deletedBy)}` : '';
      const response = await authFetch(`${baseUrl}/${id}/documents/${docId}${params}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
    },

    // Get history
    async getHistory(id: number): Promise<RecordHistory[]> {
      const response = await authFetch(`${baseUrl}/${id}/history`);
      return handleResponse<RecordHistory[]>(response);
    },

    // Add history entry
    async addHistory(id: number, data: { action: string; description?: string; changedBy?: string; changes?: Record<string, unknown> }): Promise<RecordHistory> {
      const response = await authFetch(`${baseUrl}/${id}/history`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse<RecordHistory>(response);
    },

    // Get links
    async getLinks(id: number): Promise<RecordLink[]> {
      const response = await authFetch(`${baseUrl}/${id}/links`);
      return handleResponse<RecordLink[]>(response);
    },

    // Add link
    async addLink(id: number, data: { title: string; url: string; linkType?: string; description?: string; createdBy?: string }): Promise<RecordLink> {
      const response = await authFetch(`${baseUrl}/${id}/links`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse<RecordLink>(response);
    },

    // Update link
    async updateLink(id: number, linkId: number, data: { title?: string; url?: string; linkType?: string; description?: string; updatedBy?: string }): Promise<RecordLink> {
      const response = await authFetch(`${baseUrl}/${id}/links/${linkId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return handleResponse<RecordLink>(response);
    },

    // Delete link
    async deleteLink(id: number, linkId: number, deletedBy?: string): Promise<void> {
      const params = deletedBy ? `?deletedBy=${encodeURIComponent(deletedBy)}` : '';
      const response = await authFetch(`${baseUrl}/${id}/links/${linkId}${params}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete link');
      }
    },
  };
}

// ============ EMAIL SERVICE ============

export interface EmailSendRequest {
  to: string;
  subject: string;
  message: string;
  cc?: string;
  bcc?: string;
}

export interface EmailSendResponse {
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
}

export interface EmailStatusResponse {
  configured: boolean;
  verified: boolean;
  error?: string;
  provider?: string;
}

export const emailService = {
  async send(data: EmailSendRequest): Promise<EmailSendResponse> {
    const response = await authFetch(`${API_URL}/email/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<EmailSendResponse>(response);
  },

  async getStatus(): Promise<EmailStatusResponse> {
    const response = await authFetch(`${API_URL}/email/status`);
    return handleResponse<EmailStatusResponse>(response);
  },
};

// ============ SITE SETTINGS SERVICE ============

export interface SiteSetting {
  value: string;
  type: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface SiteSettings {
  [key: string]: SiteSetting;
}

export const settingsService = {
  async getAll(): Promise<SiteSettings> {
    const response = await authFetch(`${API_URL}/settings`);
    return handleResponse<SiteSettings>(response);
  },

  async get(key: string): Promise<SiteSetting> {
    const response = await authFetch(`${API_URL}/settings/${key}`);
    return handleResponse<SiteSetting>(response);
  },

  async update(key: string, value: string, type?: string, description?: string): Promise<SiteSetting> {
    const response = await authFetch(`${API_URL}/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, type, description }),
    });
    return handleResponse<SiteSetting>(response);
  },

  async updateAll(settings: Record<string, string>): Promise<SiteSettings> {
    const response = await authFetch(`${API_URL}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return handleResponse<SiteSettings>(response);
  },

  async delete(key: string): Promise<void> {
    const response = await authFetch(`${API_URL}/settings/${key}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete setting');
    }
  },

  async getDatabaseInfo(): Promise<{ type: string; database: string }> {
    const response = await authFetch(`${API_URL}/settings/database/info`);
    return handleResponse<{ type: string; database: string }>(response);
  },

  async downloadBackup(): Promise<{ blob: Blob; filename: string }> {
    const response = await authFetch(`${API_URL}/settings/database/backup`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Backup failed' }));
      throw new Error(error.message);
    }

    // Get filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    const contentType = response.headers.get('Content-Type');

    // Default filename based on content type
    let filename = contentType?.includes('sql') ? 'backup.sql' : 'backup.db';

    if (disposition) {
      const match = disposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }

    const blob = await response.blob();
    return { blob, filename };
  },
};

// ============ PRINT QUEUE SERVICE ============

export interface PrintQueueItem {
  id: number;
  record_id: number;
  module_id: number;
  module_name: string;
  record_name: string;
  status: 'pending' | 'printed';
  printed_at?: string;
  created_by?: string;
  created_at: string;
}

export interface PrintQueueCreateRequest {
  recordId: number;
  moduleId: number;
  moduleName: string;
  recordName: string;
}

export const printQueueService = {
  async getAll(): Promise<PrintQueueItem[]> {
    const response = await authFetch(`${API_URL}/print-queue`);
    return handleResponse<PrintQueueItem[]>(response);
  },

  async getPending(): Promise<PrintQueueItem[]> {
    const response = await authFetch(`${API_URL}/print-queue/pending`);
    return handleResponse<PrintQueueItem[]>(response);
  },

  async add(data: PrintQueueCreateRequest): Promise<PrintQueueItem> {
    const response = await authFetch(`${API_URL}/print-queue`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<PrintQueueItem>(response);
  },

  async markPrinted(id: number): Promise<PrintQueueItem> {
    const response = await authFetch(`${API_URL}/print-queue/${id}/printed`, {
      method: 'PUT',
    });
    return handleResponse<PrintQueueItem>(response);
  },

  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/print-queue/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete print queue item');
    }
  },

  async clearPrinted(): Promise<void> {
    const response = await authFetch(`${API_URL}/print-queue/clear/printed`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to clear printed items');
    }
  },
};

// ============ EMAIL INBOX SERVICE ============

export interface InboxEmail {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string;
  receivedAt: string;
  bodyPreview: string;
  body?: string;
  isRead: boolean;
  hasAttachments: boolean;
  moduleName?: string | null;
  cleanSubject?: string;
}

export interface ProcessedEmail {
  id: number;
  email_id: string;
  module_id?: number;
  record_id?: number;
  from_address: string;
  from_name: string;
  subject: string;
  body_preview: string;
  received_at: string;
  processed_at: string;
  status: 'processed' | 'skipped' | 'error';
  error_message?: string;
  record_name?: string;
  record_status?: string;
}

export interface EmailProcessResult {
  success: boolean;
  processed: Array<{
    emailId: string;
    moduleId: number;
    moduleName: string;
    recordId: number;
    subject: string;
  }>;
  skipped: Array<{
    emailId: string;
    subject?: string;
    reason: string;
  }>;
  errors: Array<{
    emailId: string;
    subject?: string;
    error: string;
  }>;
  summary: {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
  };
}

export const emailInboxService = {
  // Fetch unread emails from inbox
  async fetchEmails(maxResults = 50, unreadOnly = true): Promise<InboxEmail[]> {
    const response = await authFetch(`${API_URL}/email-inbox/fetch?maxResults=${maxResults}&unreadOnly=${unreadOnly}`);
    const data = await handleResponse<{ emails: InboxEmail[] }>(response);
    return data.emails;
  },

  // Get unprocessed emails (not yet in database)
  async getUnprocessed(): Promise<InboxEmail[]> {
    const response = await authFetch(`${API_URL}/email-inbox/unprocessed`);
    const data = await handleResponse<{ emails: InboxEmail[] }>(response);
    return data.emails;
  },

  // Process all unread emails (auto-create records based on [Module] tags)
  async processEmails(): Promise<EmailProcessResult> {
    const response = await authFetch(`${API_URL}/email-inbox/process`, {
      method: 'POST',
    });
    return handleResponse<EmailProcessResult>(response);
  },

  // Process a single email manually
  async processSingle(emailId: string, moduleName?: string): Promise<{ success: boolean; recordId: number; moduleId: number; moduleName: string }> {
    const response = await authFetch(`${API_URL}/email-inbox/process-single/${encodeURIComponent(emailId)}`, {
      method: 'POST',
      body: JSON.stringify({ moduleName }),
    });
    return handleResponse<{ success: boolean; recordId: number; moduleId: number; moduleName: string }>(response);
  },

  // Get processed emails for a module
  async getModuleEmails(moduleId: number, options?: { status?: string; limit?: number; offset?: number }): Promise<{ emails: ProcessedEmail[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const response = await authFetch(`${API_URL}/email-inbox/module/${moduleId}?${params}`);
    return handleResponse<{ emails: ProcessedEmail[]; total: number }>(response);
  },
};

// ============ PAGE TEMPLATES SERVICE ============

export interface PageTemplate {
  id: number;
  name: string;
  slug: string;
  module_id: number;
  module_name?: string;
  module_display_name?: string;
  title: string;
  description?: string;
  fields?: string[];
  default_values?: Record<string, unknown>;
  success_message?: string;
  is_active: number;
  require_auth: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  moduleFields?: ModuleField[];
  formFields?: ModuleField[];
}

export interface PageTemplateCreateRequest {
  name: string;
  slug: string;
  moduleId: number;
  title: string;
  description?: string;
  fields?: string[];
  defaultValues?: Record<string, unknown>;
  successMessage?: string;
  isActive?: boolean;
  requireAuth?: boolean;
}

export interface PageTemplateSubmitResponse {
  success: boolean;
  recordId: number;
  moduleName: string;
  message: string;
}

export const pageTemplateService = {
  async getAll(): Promise<PageTemplate[]> {
    const response = await authFetch(`${API_URL}/page-templates`);
    return handleResponse<PageTemplate[]>(response);
  },

  async getById(id: number): Promise<PageTemplate> {
    const response = await authFetch(`${API_URL}/page-templates/${id}`);
    return handleResponse<PageTemplate>(response);
  },

  async getBySlug(slug: string): Promise<PageTemplate> {
    const response = await authFetch(`${API_URL}/page-templates/by-slug/${slug}`);
    return handleResponse<PageTemplate>(response);
  },

  async create(data: PageTemplateCreateRequest): Promise<PageTemplate> {
    const response = await authFetch(`${API_URL}/page-templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<PageTemplate>(response);
  },

  async update(id: number, data: Partial<PageTemplateCreateRequest>): Promise<PageTemplate> {
    const response = await authFetch(`${API_URL}/page-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<PageTemplate>(response);
  },

  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/page-templates/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete page template');
    }
  },

  async submit(slug: string, data: { name: string; data?: Record<string, unknown>; email?: string }): Promise<PageTemplateSubmitResponse> {
    const response = await authFetch(`${API_URL}/page-templates/submit/${slug}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<PageTemplateSubmitResponse>(response);
  },
};

// ============ DASHBOARD SERVICE ============

export type WidgetType = 'total_count' | 'items_by_month' | 'items_by_user' | 'items_by_status' | 'todays_items';

export interface DashboardLayout {
  top: WidgetType[];
  middle: WidgetType[];
  bottom: WidgetType[];
}

export interface Dashboard {
  id: number;
  name: string;
  slug: string;
  module_id: number;
  module_name?: string;
  module_display_name?: string;
  title: string;
  description?: string;
  widgets?: WidgetType[];
  layout?: DashboardLayout;
  date_range_default: string;
  is_active: number;
  require_auth: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardCreateRequest {
  name: string;
  slug: string;
  moduleId: number;
  title: string;
  description?: string;
  widgets?: WidgetType[];
  layout?: DashboardLayout;
  dateRangeDefault?: string;
  isActive?: boolean;
  requireAuth?: boolean;
}

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface TodaysItem {
  id: number;
  data: Record<string, unknown>;
  status: string;
  created_by: string;
  created_at: string;
}

export interface DashboardStats {
  moduleId: number;
  moduleName: string;
  moduleDisplayName: string;
  dateRange: string;
  widgets: {
    total_count?: {
      type: 'total_count';
      data: { count: number };
    };
    items_by_month?: {
      type: 'items_by_month';
      data: ChartData;
    };
    items_by_user?: {
      type: 'items_by_user';
      data: ChartData;
    };
    items_by_status?: {
      type: 'items_by_status';
      data: ChartData;
    };
    todays_items?: {
      type: 'todays_items';
      data: { items: TodaysItem[]; count: number };
    };
  };
}

export const dashboardService = {
  async getAll(): Promise<Dashboard[]> {
    const response = await authFetch(`${API_URL}/dashboards`);
    return handleResponse<Dashboard[]>(response);
  },

  async getById(id: number): Promise<Dashboard> {
    const response = await authFetch(`${API_URL}/dashboards/${id}`);
    return handleResponse<Dashboard>(response);
  },

  async getBySlug(slug: string): Promise<Dashboard> {
    const response = await authFetch(`${API_URL}/dashboards/by-slug/${slug}`);
    return handleResponse<Dashboard>(response);
  },

  async create(data: DashboardCreateRequest): Promise<Dashboard> {
    const response = await authFetch(`${API_URL}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<Dashboard>(response);
  },

  async update(id: number, data: Partial<DashboardCreateRequest>): Promise<Dashboard> {
    const response = await authFetch(`${API_URL}/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<Dashboard>(response);
  },

  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/dashboards/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete dashboard');
    }
  },

  async getStats(id: number, days?: string): Promise<DashboardStats> {
    const params = days ? `?days=${days}` : '';
    const response = await authFetch(`${API_URL}/dashboards/${id}/stats${params}`);
    return handleResponse<DashboardStats>(response);
  },
};

// ============ BASIC PAGES SERVICE ============

export interface BasicPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  menu_id: number | null;
  menu_display_name?: string;
  page_type: string;
  is_published: number;
  show_in_menu: number;
  sort_order: number;
  icon: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BasicPageCreateRequest {
  title: string;
  slug: string;
  content?: string;
  menuId?: number | null;
  pageType?: string;
  isPublished?: boolean;
  showInMenu?: boolean;
  sortOrder?: number;
  icon?: string | null;
}

export const basicPageService = {
  async getAll(): Promise<BasicPage[]> {
    const response = await authFetch(`${API_URL}/basic-pages`);
    return handleResponse<BasicPage[]>(response);
  },

  async getById(id: number): Promise<BasicPage> {
    const response = await authFetch(`${API_URL}/basic-pages/${id}`);
    return handleResponse<BasicPage>(response);
  },

  async getBySlug(slug: string): Promise<BasicPage> {
    const response = await authFetch(`${API_URL}/basic-pages/by-slug/${slug}`);
    return handleResponse<BasicPage>(response);
  },

  async getByMenu(menuId: number): Promise<BasicPage[]> {
    const response = await authFetch(`${API_URL}/basic-pages/menu/${menuId}`);
    return handleResponse<BasicPage[]>(response);
  },

  async create(data: BasicPageCreateRequest): Promise<BasicPage> {
    const response = await authFetch(`${API_URL}/basic-pages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return handleResponse<BasicPage>(response);
  },

  async update(id: number, data: Partial<BasicPageCreateRequest>): Promise<BasicPage> {
    const response = await authFetch(`${API_URL}/basic-pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return handleResponse<BasicPage>(response);
  },

  async delete(id: number): Promise<void> {
    const response = await authFetch(`${API_URL}/basic-pages/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete page');
    }
  },

  async uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const response = await authFetch(`${API_URL}/basic-pages/upload-image`, {
            method: 'POST',
            body: JSON.stringify({ image: base64 }),
          });
          const data = await handleResponse<{ url: string }>(response);
          resolve(data.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },
};

# BaristaCMS API Documentation

Complete REST API reference for BaristaCMS backend server.

## Base URL

```
Production: https://baristacms-api.azurewebsites.net
Development: http://localhost:3001
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

### Auth Types
- **Local Auth**: JWT tokens with 8-hour expiration
- **M365/Azure AD**: Azure AD tokens verified against tenant

---

## Authentication Routes

### POST `/api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  },
  "mustChangePassword": false
}
```

---

### POST `/api/auth/change-password`
Change password for authenticated user.

**Auth Required:** Yes

**Request Body:**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

---

### POST `/api/auth/verify`
Verify if current token is valid.

**Auth Required:** Yes

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

---

## User Routes

### GET `/api/users/me`
Get current authenticated user.

**Auth Required:** Yes

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "is_active": 1,
  "auth_type": "local"
}
```

---

### GET `/api/users`
Get all users (admin only).

**Auth Required:** Yes (Admin)

**Response:**
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "is_active": 1,
    "auth_type": "local",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### POST `/api/users`
Create new user.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "role": "user",
  "password": "optional-password"
}
```

---

### PUT `/api/users/:id`
Update user details.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "Updated Name",
  "role": "editor",
  "is_active": 1
}
```

---

### PUT `/api/users/:id/reset-password`
Reset user password (admin only).

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "password": "newpassword123"
}
```

---

### DELETE `/api/users/:id`
Delete user.

**Auth Required:** Yes (Admin)

---

### GET `/api/users/:id/permissions`
Get permissions for a specific user.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "module": "inventory",
    "permission": "write"
  }
]
```

---

### PUT `/api/users/:id/permissions`
Update user permissions.

**Auth Required:** Yes (Admin)

**Request Body (single):**
```json
{
  "module": "inventory",
  "permission": "write"
}
```

**Request Body (bulk):**
```json
{
  "permissions": [
    { "module": "inventory", "permission": "write" },
    { "module": "orders", "permission": "read" }
  ]
}
```

---

### GET `/api/permissions/check`
Check permission for current user on a module.

**Auth Required:** Yes

**Query Parameters:**
- `module` - Module name to check

**Response:**
```json
{
  "permission": "write"
}
```

---

## Group Routes

Groups control user access to modules and menu items.

### GET `/api/groups`
Get all active groups with member/module counts.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "name": "production",
    "display_name": "Production Team",
    "description": "Production staff",
    "color": "#4CAF50",
    "is_active": 1,
    "member_count": 5,
    "module_count": 3,
    "menu_count": 2
  }
]
```

---

### GET `/api/groups/:id`
Get single group with members, modules, and menu items.

**Auth Required:** Yes

**Response:**
```json
{
  "id": 1,
  "name": "production",
  "display_name": "Production Team",
  "members": [
    { "id": 1, "email": "user@example.com", "name": "John" }
  ],
  "modules": [
    { "id": 1, "name": "inventory", "display_name": "Inventory" }
  ],
  "menuItems": [
    { "id": 1, "name": "dashboard", "display_name": "Dashboard" }
  ]
}
```

---

### POST `/api/groups`
Create new group.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "sales",
  "displayName": "Sales Team",
  "description": "Sales department",
  "color": "#2196F3"
}
```

---

### PUT `/api/groups/:id`
Update group.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "displayName": "Updated Name",
  "description": "Updated description",
  "color": "#FF5722",
  "isActive": true
}
```

---

### DELETE `/api/groups/:id`
Delete group.

**Auth Required:** Yes (Admin)

---

### PUT `/api/groups/:id/members`
Replace all group members.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "userIds": [1, 2, 3]
}
```

---

### PUT `/api/groups/:id/modules`
Replace all group module access.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "moduleIds": [1, 2, 3]
}
```

---

### PUT `/api/groups/:id/menu-items`
Replace all group menu item access.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "menuItemIds": [1, 2, 3]
}
```

---

### GET `/api/groups/user/:userId`
Get groups for a specific user.

**Auth Required:** Yes

---

### GET `/api/groups/user/:userId/modules`
Get accessible modules for user based on group membership.

**Auth Required:** Yes

**Response:**
```json
{
  "isAdmin": false,
  "modules": [
    { "id": 1, "name": "inventory" }
  ]
}
```

---

## Module Routes

### GET `/api/modules`
Get all active modules.

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "name": "inventory",
    "display_name": "Inventory",
    "description": "Manage inventory items",
    "icon": "inventory",
    "config": { "showImages": true },
    "use_in_app": 1
  }
]
```

---

### GET `/api/modules/app`
Get modules enabled for mobile app (filtered by user's group access).

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "name": "inventory",
    "display_name": "Inventory",
    "icon": "inventory"
  }
]
```

---

### GET `/api/modules/:name`
Get module by name with all fields.

**Auth Required:** Yes

**Response:**
```json
{
  "id": 1,
  "name": "inventory",
  "display_name": "Inventory",
  "fields": [
    {
      "id": 1,
      "name": "sku",
      "display_name": "SKU",
      "field_type": "text",
      "is_required": 1,
      "sort_order": 1,
      "options": {}
    }
  ]
}
```

---

### POST `/api/modules`
Create new module.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "products",
  "displayName": "Products",
  "description": "Product catalog",
  "icon": "shopping_cart",
  "menuId": 1,
  "config": {
    "showImages": true,
    "allowComments": false
  },
  "fields": [
    {
      "name": "price",
      "displayName": "Price",
      "fieldType": "number",
      "isRequired": true
    }
  ]
}
```

---

### PUT `/api/modules/:name`
Update module.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "displayName": "Updated Name",
  "description": "Updated description",
  "icon": "new_icon",
  "useInApp": true,
  "fields": []
}
```

---

### DELETE `/api/modules/:name`
Delete module and all its records.

**Auth Required:** Yes (Admin)

---

### GET `/api/modules/:name/submodules`
Get sub-modules for a parent module.

**Auth Required:** Yes

---

## Record Routes

Records are accessed through their parent module.

### GET `/api/m/:moduleName/records`
Get all records for a module.

**Auth Required:** Yes + Module Access

**Response:**
```json
[
  {
    "id": 1,
    "name": "Item 001",
    "data": { "sku": "SKU001", "price": 99.99 },
    "status": "active",
    "created_at": "2024-01-01T00:00:00.000Z",
    "created_by": "John Doe",
    "images": [
      { "id": 1, "url": "/uploads/image.jpg", "sort_order": 0 }
    ],
    "is_viewed": true
  }
]
```

---

### GET `/api/m/:moduleName/records/:id`
Get single record with full details.

**Auth Required:** Yes + Module Access

**Response:**
```json
{
  "id": 1,
  "name": "Item 001",
  "data": { "sku": "SKU001" },
  "status": "active",
  "images": [],
  "documents": [],
  "history": [
    {
      "id": 1,
      "action": "created",
      "description": "Record created",
      "changed_by": "John Doe",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/m/:moduleName/records`
Create new record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "name": "New Item",
  "data": {
    "sku": "SKU002",
    "price": 149.99
  },
  "status": "active",
  "createdBy": "John Doe",
  "parentRecordId": null,
  "assignedTo": "jane@example.com"
}
```

---

### PUT `/api/m/:moduleName/records/:id`
Update record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "name": "Updated Item",
  "data": {
    "sku": "SKU002-A",
    "price": 159.99
  },
  "status": "updated",
  "updatedBy": "John Doe"
}
```

---

### DELETE `/api/m/:moduleName/records/:id`
Delete record and all associated assets.

**Auth Required:** Yes + Module Access

---

### POST `/api/m/:moduleName/records/:id/images`
Add image to record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "createdBy": "John Doe"
}
```

---

### DELETE `/api/m/:moduleName/records/:id/images/:imageId`
Delete image from record.

**Auth Required:** Yes + Module Access

---

### PUT `/api/m/:moduleName/records/:id/images/reorder`
Reorder record images.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "imageIds": [3, 1, 2]
}
```

---

### GET `/api/m/:moduleName/records/:id/documents`
Get all documents for record.

**Auth Required:** Yes + Module Access

---

### POST `/api/m/:moduleName/records/:id/documents`
Add document to record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "file": "data:application/pdf;base64,JVBERi0...",
  "name": "invoice.pdf",
  "fileType": "application/pdf",
  "uploadedBy": "John Doe"
}
```

---

### DELETE `/api/m/:moduleName/records/:id/documents/:docId`
Delete document from record.

**Auth Required:** Yes + Module Access

---

### GET `/api/m/:moduleName/records/:id/history`
Get record change history.

**Auth Required:** Yes + Module Access

---

### POST `/api/m/:moduleName/records/:id/history`
Add note/entry to record history.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "action": "note",
  "description": "Called customer about this item",
  "changedBy": "John Doe"
}
```

---

### GET `/api/m/:moduleName/records/:id/links`
Get all links for record.

**Auth Required:** Yes + Module Access

---

### POST `/api/m/:moduleName/records/:id/links`
Add link to record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "url": "https://example.com/resource",
  "title": "External Resource",
  "description": "Related documentation"
}
```

---

### PUT `/api/m/:moduleName/records/:id/links/:linkId`
Update record link.

**Auth Required:** Yes + Module Access

---

### DELETE `/api/m/:moduleName/records/:id/links/:linkId`
Delete record link.

**Auth Required:** Yes + Module Access

---

### GET `/api/m/:moduleName/records/:id/companies`
Get companies linked to record.

**Auth Required:** Yes + Module Access

---

### POST `/api/m/:moduleName/records/:id/companies`
Link company to record.

**Auth Required:** Yes + Module Access

**Request Body:**
```json
{
  "companyId": 1,
  "relationshipType": "vendor"
}
```

---

### DELETE `/api/m/:moduleName/records/:id/companies/:companyId`
Unlink company from record.

**Auth Required:** Yes + Module Access

---

### GET `/api/m/:moduleName/records/:id/children-count`
Get count of child records across all sub-modules.

**Auth Required:** Yes + Module Access

**Response:**
```json
{
  "totalCount": 15,
  "breakdown": [
    { "moduleName": "tasks", "displayName": "Tasks", "count": 10 },
    { "moduleName": "notes", "displayName": "Notes", "count": 5 }
  ]
}
```

---

### GET `/api/m/:moduleName/records/:id/children/:subModuleName`
Get child records from specific sub-module.

**Auth Required:** Yes + Module Access

---

## Menu Routes

### GET `/api/menu`
Get menu tree for current user (filtered by role and group access).

**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "name": "dashboard",
    "display_name": "Dashboard",
    "icon": "dashboard",
    "path": "/dashboard",
    "children": [],
    "modules": []
  }
]
```

---

### GET `/api/menu/all`
Get all menu items (admin view, unfiltered).

**Auth Required:** Yes (Admin)

---

### GET `/api/menu/unread-counts`
Get unread record counts per module.

**Auth Required:** Yes

**Response:**
```json
{
  "inventory": 5,
  "orders": 12
}
```

---

### POST `/api/menu`
Create menu item.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "reports",
  "displayName": "Reports",
  "icon": "assessment",
  "path": "/reports",
  "parentId": null,
  "sortOrder": 10,
  "isActive": true,
  "requiredRole": "manager"
}
```

---

### PUT `/api/menu/reorder`
Reorder menu items.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "items": [
    { "id": 1, "sort_order": 0, "parent_id": null },
    { "id": 2, "sort_order": 1, "parent_id": null }
  ]
}
```

---

### PUT `/api/menu/:id`
Update menu item.

**Auth Required:** Yes (Admin)

---

### DELETE `/api/menu/:id`
Delete menu item.

**Auth Required:** Yes (Admin)

---

## Settings Routes

### GET `/api/settings/public/:key`
Get public setting (only `site_name` allowed).

**Auth Required:** No

---

### GET `/api/settings`
Get all settings.

**Auth Required:** Yes (Admin)

**Response:**
```json
{
  "site_name": {
    "value": "BaristaCMS",
    "type": "string",
    "description": "Site name",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/api/settings/:key`
Get single setting by key.

**Auth Required:** Yes

---

### PUT `/api/settings/:key`
Create or update setting.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "value": "New Value",
  "type": "string",
  "description": "Setting description"
}
```

---

### PUT `/api/settings`
Bulk update multiple settings.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "site_name": "My CMS",
  "items_per_page": "25"
}
```

---

### DELETE `/api/settings/:key`
Delete a setting.

**Auth Required:** Yes (Admin)

---

### GET `/api/settings/database/info`
Get database type and name.

**Auth Required:** Yes (Admin)

**Response:**
```json
{
  "type": "sqlite",
  "database": "baristacms.db"
}
```

---

### GET `/api/settings/database/backup`
Download database backup file.

**Auth Required:** Yes (Admin)

**Response:** Binary file download

---

## Print Queue Routes

### GET `/api/print-queue`
Get all print queue items.

**Auth Required:** Yes

---

### GET `/api/print-queue/pending`
Get pending (unprinted) items.

**Auth Required:** Yes

---

### POST `/api/print-queue`
Add item to print queue.

**Auth Required:** Yes

**Request Body:**
```json
{
  "recordId": 1,
  "moduleId": 1,
  "moduleName": "inventory",
  "recordName": "Item 001"
}
```

---

### PUT `/api/print-queue/:id/printed`
Mark item as printed.

**Auth Required:** Yes

---

### DELETE `/api/print-queue/:id`
Delete print queue item.

**Auth Required:** Yes

---

### DELETE `/api/print-queue/clear/printed`
Clear all printed items.

**Auth Required:** Yes

---

## Page Templates Routes

### GET `/api/page-templates`
Get all page templates (admin).

**Auth Required:** Yes (Admin)

---

### GET `/api/page-templates/by-slug/:slug`
Get template by slug.

**Auth Required:** Conditional (based on `requireAuth` setting)

---

### GET `/api/page-templates/:id`
Get template by ID (admin).

**Auth Required:** Yes (Admin)

---

### POST `/api/page-templates`
Create page template.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "Contact Form",
  "slug": "contact",
  "moduleId": 1,
  "title": "Contact Us",
  "description": "Get in touch",
  "fields": ["name", "email", "message"],
  "defaultValues": {},
  "successMessage": "Thank you for your submission!",
  "isActive": true,
  "requireAuth": false
}
```

---

### PUT `/api/page-templates/:id`
Update page template.

**Auth Required:** Yes (Admin)

---

### DELETE `/api/page-templates/:id`
Delete page template.

**Auth Required:** Yes (Admin)

---

### POST `/api/page-templates/submit/:slug`
Submit form to create record.

**Auth Required:** Conditional

**Request Body:**
```json
{
  "name": "Submission from John",
  "data": {
    "email": "john@example.com",
    "message": "Hello!"
  },
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "recordId": 123,
  "moduleName": "contacts",
  "message": "Thank you for your submission!"
}
```

---

## Dashboard Routes

### GET `/api/dashboards`
Get all dashboards (admin).

**Auth Required:** Yes (Admin)

---

### GET `/api/dashboards/by-slug/:slug`
Get dashboard by slug.

**Auth Required:** Conditional

---

### GET `/api/dashboards/:id`
Get dashboard by ID (admin).

**Auth Required:** Yes (Admin)

---

### GET `/api/dashboards/:id/stats`
Get computed statistics for dashboard widgets.

**Auth Required:** Conditional

**Query Parameters:**
- `days` - Number of days for date range (default: 30)

**Response:**
```json
{
  "total_count": 150,
  "items_by_month": [
    { "month": "2024-01", "count": 45 }
  ],
  "items_by_status": [
    { "status": "active", "count": 100 }
  ]
}
```

---

### POST `/api/dashboards`
Create dashboard.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "name": "Sales Dashboard",
  "slug": "sales",
  "moduleId": 1,
  "title": "Sales Overview",
  "widgets": [
    { "type": "total_count", "title": "Total Sales" }
  ],
  "layout": { "columns": 2 },
  "dateRangeDefault": 30,
  "isActive": true,
  "requireAuth": true
}
```

**Widget Types:**
- `total_count` - Total record count
- `items_by_month` - Records grouped by month
- `items_by_user` - Records grouped by creator
- `items_by_status` - Records grouped by status
- `todays_items` - Today's records

---

### PUT `/api/dashboards/:id`
Update dashboard.

**Auth Required:** Yes (Admin)

---

### DELETE `/api/dashboards/:id`
Delete dashboard.

**Auth Required:** Yes (Admin)

---

## Basic Pages Routes

### GET `/api/basic-pages`
Get all basic pages (admin).

**Auth Required:** Yes (Admin)

---

### GET `/api/basic-pages/menu/:menuId`
Get published pages for a menu item.

**Auth Required:** Yes

---

### GET `/api/basic-pages/by-slug/:slug`
Get page by slug.

**Auth Required:** Conditional (public if published)

---

### GET `/api/basic-pages/:id`
Get page by ID (admin).

**Auth Required:** Yes (Admin)

---

### POST `/api/basic-pages`
Create basic page.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "title": "About Us",
  "slug": "about",
  "content": "<h1>About</h1><p>Content here...</p>",
  "menuId": 1,
  "pageType": "content",
  "isPublished": true,
  "showInMenu": true,
  "sortOrder": 0,
  "icon": "info"
}
```

---

### PUT `/api/basic-pages/:id`
Update basic page.

**Auth Required:** Yes (Admin)

---

### DELETE `/api/basic-pages/:id`
Delete basic page.

**Auth Required:** Yes (Admin)

---

### POST `/api/basic-pages/upload-image`
Upload image for page content.

**Auth Required:** Yes (Admin)

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response:**
```json
{
  "url": "/uploads/page-image-123456.jpg"
}
```

---

## Email Routes

### POST `/api/email/send`
Send email.

**Auth Required:** Yes

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "message": "Email body content",
  "cc": "cc@example.com",
  "bcc": "bcc@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "abc123",
  "message": "Email sent successfully"
}
```

---

### GET `/api/email/status`
Check email configuration status.

**Auth Required:** Yes (Admin)

**Response:**
```json
{
  "configured": true,
  "verified": true,
  "provider": "smtp"
}
```

---

## Health Check

### GET `/api/health`
Server health check.

**Auth Required:** No

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `204` - No Content (successful delete)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (no access)
- `404` - Not Found
- `500` - Internal Server Error

---

## Field Types

Module fields support these types:

| Type | Description |
|------|-------------|
| `text` | Single line text |
| `textarea` | Multi-line text |
| `number` | Numeric value |
| `date` | Date picker |
| `datetime` | Date and time |
| `select` | Dropdown selection |
| `multiselect` | Multiple selection |
| `checkbox` | Boolean checkbox |
| `email` | Email address |
| `url` | URL/link |
| `phone` | Phone number |
| `currency` | Currency value |
| `file` | File upload |
| `image` | Image upload |
| `rich_text` | Rich text editor |
| `barcode` | Barcode scanner |

---

## Access Control

### User Roles
- `admin` - Full access to everything
- `manager` - Extended access
- `editor` - Can edit records
- `viewer` - Read-only access
- `user` - Basic access

### Group-Based Access
- Users can be assigned to groups
- Groups grant access to specific modules and menu items
- Admin users bypass all group restrictions
- Access is union of all user's groups

---

## Notes

1. **File Uploads**: All file uploads use base64 encoding in request body
2. **JSON Fields**: Module config, field options, widgets use JSON objects
3. **Pagination**: Currently not implemented - all records returned
4. **Rate Limiting**: Not currently implemented
5. **CORS**: Enabled for all origins in development

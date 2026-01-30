

# Authentication & User Management Implementation Plan

## Overview
This plan implements a complete authentication system with login page (featuring the Quickapp logo), user creation, role-based access control, user hierarchy management, and module-level permission enforcement.

---

## 1. Database Schema Design

### Tables to Create

#### 1.1 `profiles` - User Profiles
Stores extended user information linked to auth.users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | References auth.users(id) |
| username | TEXT | Display name |
| email | TEXT | User email |
| role_id | UUID (FK) | References user_roles_master |
| reports_to | UUID (FK) | References profiles (hierarchy) |
| status | TEXT | active/inactive |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### 1.2 `user_roles_master` - Role Definitions
Stores manually created user roles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| name | TEXT | Role name (e.g., Admin, Store Manager) |
| description | TEXT | Role description |
| status | TEXT | active/inactive |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### 1.3 `role_permissions` - Permission Assignments
Maps roles to module permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | |
| role_id | UUID (FK) | References user_roles_master |
| module_key | TEXT | Module identifier (e.g., "pos", "stores") |
| can_view | BOOLEAN | View access |
| can_create | BOOLEAN | Create access |
| can_edit | BOOLEAN | Edit access |
| can_delete | BOOLEAN | Delete access |
| created_at | TIMESTAMP | |

### Security Functions
```text
SECURITY DEFINER function: has_role(user_id, role_name)
  - Checks if user has specific role
  - Used in RLS policies to prevent recursion

SECURITY DEFINER function: get_user_permissions(user_id)
  - Returns all module permissions for user
  - Used for frontend permission filtering
```

### RLS Policies
- profiles: Users can read their own profile; admins can read all
- user_roles_master: All authenticated users can read
- role_permissions: All authenticated users can read

---

## 2. Application Modules List

The following modules will be permission-controlled:

| Module Key | Display Name | Parent |
|------------|--------------|--------|
| dashboard | Dashboard | - |
| pos | Point of Sale | - |
| pos.quicksale | Quick Sale | pos |
| pos.products | Product Master | pos |
| pos.orders | Order History | pos |
| pos.schemes | Schemes | pos |
| stores | Store Management | - |
| stores.all | All Stores | stores |
| stores.rentals | Rentals & Leases | stores |
| stores.nso | New Store Opening | stores |
| assets | Assets & Vendors | - |
| vendors | Vendors | - |
| pettycash | Petty Cash | - |
| utilities | Utilities | - |
| staff | Staff Management | - |
| security | Security | - |
| footfall | Footfall | - |
| vm | Visual Merchandising | - |
| inventory | Inventory | - |
| operations | Store Operations | - |
| master | Master Data | - |
| usermanagement | User Management | - |

---

## 3. Component Architecture

```text
src/
├── pages/
│   ├── auth/
│   │   └── Login.tsx              # Login page with Quickapp logo
│   └── admin/
│       ├── Users.tsx              # User creation & management
│       ├── UserRoles.tsx          # Role creation & management
│       ├── UserHierarchy.tsx      # Org chart view
│       └── RolePermissions.tsx    # Permission matrix editor
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx       # Context for auth state
│   │   ├── ProtectedRoute.tsx     # Route guard component
│   │   └── PermissionGate.tsx     # Component-level permission
│   └── admin/
│       ├── UserFormDialog.tsx     # Create/edit user modal
│       ├── RoleFormDialog.tsx     # Create/edit role modal
│       ├── HierarchyTree.tsx      # Org chart visualization
│       └── PermissionMatrix.tsx   # Module permission grid
├── hooks/
│   ├── useAuth.ts                 # Authentication hook
│   └── usePermissions.ts          # Permission checking hook
└── lib/
    └── modules.ts                 # Module definitions
```

---

## 4. Implementation Details

### 4.1 Login Page (`src/pages/auth/Login.tsx`)
- Full-screen centered layout
- Quickapp logo (uploaded image) prominently displayed
- Email/password form with validation (using zod)
- "Remember me" checkbox
- Error handling with toast notifications
- Auto-redirect to dashboard on successful login
- Clean, modern design matching app theme

### 4.2 Auth Provider (`src/components/auth/AuthProvider.tsx`)
- Uses `supabase.auth.onAuthStateChange` for session management
- Stores session and user in React context
- Fetches user profile and permissions on login
- Provides `signIn`, `signUp`, `signOut` methods
- Redirects unauthenticated users to /login

### 4.3 User Management (`src/pages/admin/Users.tsx`)
**Form Fields:**
- Username (required)
- Email (required, validated)
- Password (required, min 8 chars)
- User Role (dropdown from user_roles_master)
- Reports To (dropdown of other users)
- Status (active/inactive)

**Features:**
- DataTable with search and filters
- Create/Edit/Delete operations
- Bulk actions

### 4.4 User Hierarchy (`src/pages/admin/UserHierarchy.tsx`)
- Tree visualization based on `reports_to` relationships
- Expandable/collapsible nodes
- Click to view user details
- Filter by role or department

### 4.5 User Roles (`src/pages/admin/UserRoles.tsx`)
- CRUD for role definitions
- Role name and description
- Shows count of users per role
- Cannot delete roles with assigned users

### 4.6 Role Permissions (`src/pages/admin/RolePermissions.tsx`)
- Matrix view: Roles as columns, Modules as rows
- Checkboxes for each permission type (view/create/edit/delete)
- Parent module permissions cascade to children
- Save button to persist changes

### 4.7 Sidebar Filtering
The `AppSidebar.tsx` will be modified to:
1. Receive user permissions from context
2. Filter navigation items based on `can_view` permission
3. Hide entire parent menus if no children are visible

```text
Flow:
1. User logs in
2. AuthProvider fetches permissions from role_permissions
3. AppSidebar receives permissions via usePermissions hook
4. Navigation items filtered before render
5. User only sees permitted modules
```

---

## 5. Route Protection

### App.tsx Changes
```text
<Routes>
  {/* Public route */}
  <Route path="/login" element={<Login />} />
  
  {/* Protected routes */}
  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
    <Route path="/" element={<Dashboard />} />
    ...all other routes
  </Route>
</Routes>
```

### ProtectedRoute Component
- Checks authentication state
- Redirects to /login if not authenticated
- Optionally checks specific permissions
- Shows loading state during auth check

---

## 6. File Changes Summary

### New Files (12)
| File | Purpose |
|------|---------|
| `src/pages/auth/Login.tsx` | Login page |
| `src/pages/admin/Users.tsx` | User management |
| `src/pages/admin/UserRoles.tsx` | Role management |
| `src/pages/admin/UserHierarchy.tsx` | Org chart |
| `src/pages/admin/RolePermissions.tsx` | Permission matrix |
| `src/components/auth/AuthProvider.tsx` | Auth context |
| `src/components/auth/ProtectedRoute.tsx` | Route guard |
| `src/components/auth/PermissionGate.tsx` | Permission wrapper |
| `src/components/admin/UserFormDialog.tsx` | User form |
| `src/components/admin/RoleFormDialog.tsx` | Role form |
| `src/hooks/useAuth.ts` | Auth hook |
| `src/hooks/usePermissions.ts` | Permissions hook |
| `src/lib/modules.ts` | Module definitions |
| `src/assets/quickapp-logo.png` | Logo file |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/App.tsx` | Add auth routes, wrap with AuthProvider |
| `src/components/layout/AppSidebar.tsx` | Filter nav by permissions |
| `src/components/layout/AppHeader.tsx` | Show user info, logout |

### Database Migrations
- Create `user_roles_master` table
- Create `profiles` table with foreign keys
- Create `role_permissions` table
- Create security definer functions
- Set up RLS policies

---

## 7. Technical Considerations

### Security
- Passwords handled by Supabase Auth (never stored in profiles)
- RLS policies enforce data access at database level
- SECURITY DEFINER functions prevent RLS recursion
- Roles stored in separate table (not on profiles) per security best practices
- Email confirmation auto-enabled for production safety

### User Experience
- Loading states during auth operations
- Toast notifications for success/error
- Form validation with clear error messages
- Responsive design for mobile users
- Smooth redirects after login/logout

### Performance
- Permissions cached in context (refreshed on login)
- Sidebar filtering done client-side for speed
- Lazy loading for admin pages


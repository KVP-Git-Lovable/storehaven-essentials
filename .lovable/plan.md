
# Admin Password Reset and User Details Display Implementation

## Overview

This plan implements two key features for the Users management page:
1. **Admin Password Reset**: Add a "Reset Password" option in the edit user dialog that allows admins to set a new temporary password for any user
2. **Clickable Username**: Make the Username column clickable to display a detailed user information sheet/dialog

---

## Current State Analysis

### Existing Infrastructure
- **User Management**: `src/pages/admin/Users.tsx` displays a table of users with edit/delete actions
- **User Form Dialog**: `src/components/admin/UserFormDialog.tsx` handles creating and editing users
- **Edge Function**: `supabase/functions/create-user/index.ts` creates users with admin verification via service role
- **Profile Page**: `src/pages/admin/Profile.tsx` allows users to change their own password (requires current password verification)
- **Force Reset Dialog**: `src/components/auth/ForcePasswordResetDialog.tsx` exists for mandatory first-login password reset
- **Database**: `profiles` table has `must_reset_password` boolean column

### Gap Analysis
- No admin-initiated password reset functionality exists
- Username column is plain text, not clickable
- No user details view/sheet component exists

---

## Implementation Plan

### Phase 1: Create Admin Password Reset Edge Function

Create a new edge function that:
- Verifies the requesting user is an admin
- Uses the admin API to update another user's password
- Sets `must_reset_password: true` so user must change it on next login

```text
supabase/functions/reset-user-password/index.ts

Flow:
1. Verify authorization token
2. Check requesting user is admin via is_admin() RPC
3. Use admin.updateUserById() to set new password
4. Update profiles.must_reset_password = true
5. Return success/error response
```

### Phase 2: Create User Details Sheet Component

Create a new component to display comprehensive user information:
- Username, Email, Role, Status
- Reports To (manager name)
- Account creation date
- Last updated date
- Store assignments (if any)

```text
src/components/admin/UserDetailsSheet.tsx

Structure:
- Sheet component (slides in from right)
- Organized sections with labels
- Badge display for role and status
- Formatted dates
```

### Phase 3: Add Admin Password Reset Dialog

Create a dialog for admins to reset a user's password:
- New password input with visibility toggle
- Confirm password input
- Confirmation warning that user will need to reset on login
- Calls the edge function

```text
src/components/admin/AdminPasswordResetDialog.tsx

Flow:
1. Admin enters new password for user
2. Confirms password
3. Submits to edge function
4. User's must_reset_password flag is set to true
5. Success notification
```

### Phase 4: Update UserFormDialog

Modify the edit user dialog to include:
- A "Reset Password" button (only visible in edit mode)
- Opens the AdminPasswordResetDialog when clicked

### Phase 5: Update Users Page

Modify the Users page to:
- Make Username column clickable (styled as a link)
- Open UserDetailsSheet when username is clicked
- Track selected user for details view separately from edit

---

## Technical Details

### Edge Function: reset-user-password

```text
Endpoint: POST /functions/v1/reset-user-password
Body: { userId: string, newPassword: string }
Auth: Bearer token (admin only)

Security:
- Validates admin status via is_admin() RPC
- Uses service role key for admin.updateUserById()
- Sets must_reset_password flag in profiles table
```

### User Details Sheet Structure

```text
UserDetailsSheet
├── SheetHeader
│   └── User avatar/icon + username
├── SheetContent
│   ├── Account Information
│   │   ├── Email
│   │   ├── Role (badge)
│   │   └── Status (badge)
│   ├── Organization
│   │   └── Reports To
│   ├── Store Access (if applicable)
│   │   └── List of assigned stores
│   └── Timestamps
│       ├── Created At
│       └── Updated At
```

---

## Files to be Created/Modified

| File | Type | Description |
|------|------|-------------|
| `supabase/functions/reset-user-password/index.ts` | Create | Edge function for admin password reset |
| `src/components/admin/AdminPasswordResetDialog.tsx` | Create | Dialog for admin to set new user password |
| `src/components/admin/UserDetailsSheet.tsx` | Create | Sheet displaying user information |
| `src/components/admin/UserFormDialog.tsx` | Edit | Add "Reset Password" button in edit mode |
| `src/pages/admin/Users.tsx` | Edit | Make username clickable, add details sheet state |

---

## User Experience Flow

### Admin Password Reset Flow
1. Admin clicks "Edit" button on a user row
2. Edit dialog opens with existing "Reset Password" button
3. Admin clicks "Reset Password"
4. Password reset dialog opens (separate from edit dialog)
5. Admin enters and confirms new password
6. System updates password and sets must_reset_password flag
7. User sees forced password reset dialog on next login

### User Details Flow
1. Admin clicks on a username in the table
2. Details sheet slides in from the right
3. Shows comprehensive user information
4. Admin can close by clicking X or clicking outside

---

## Security Considerations

1. **Admin Verification**: Edge function verifies admin status server-side using the `is_admin()` database function
2. **Service Role**: Password updates use service role key (not exposed to client)
3. **Forced Reset**: Users must change admin-set passwords on first login
4. **Audit Trail**: Profile's `updated_at` timestamp is updated when password is reset

---

## Testing Checklist

After implementation, verify:
- [ ] Admin can see "Reset Password" button when editing a user
- [ ] Password reset dialog validates matching passwords
- [ ] Edge function rejects non-admin requests
- [ ] User's must_reset_password flag is set after admin reset
- [ ] User sees ForcePasswordResetDialog on next login
- [ ] Username column shows hover/click styling
- [ ] Clicking username opens details sheet
- [ ] Details sheet shows all user information correctly
- [ ] Users can still reset their own password via Profile page

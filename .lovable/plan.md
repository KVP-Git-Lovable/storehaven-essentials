## Finding

The email `abhishek.kvp2979@gmail.com` exists in the database as an active `Admin` user. The page is only showing the currently visible manager because the client-side Users page still depends on hierarchy/RLS-filtered profile reads, so a non-admin viewer does not receive the admin profile row from the normal `profiles` query.

## Plan

1. **Add a safe backend read path for Users & Roles**
   - Create/update a security-definer database function for the Users & Roles page that returns user list rows only to users who already have `usermanagement.users` view permission or admin access.
   - Keep sensitive auth/password data untouched and unreturned.
   - Return the same fields the page already uses: user id, username, email, role id/name, manager id/name, and status.

2. **Update `/admin/users` data loading only**
   - Change `src/pages/admin/Users.tsx` so `fetchUsers()` reads from the permission-gated function instead of the raw `profiles` table query.
   - Keep the existing search, role badges, hierarchy filtering, edit/delete/status behavior, and UI unchanged.
   - Preserve the previous fallback/error toast behavior.

3. **Fix the admin-role visibility check**
   - Make the page treat `Admin`, `Super Admin`, `Super-Admin`, and similar spacing/case variants consistently as admin roles.
   - This ensures Abhishek appears in the count and table when returned by the backend function.

4. **Validate without changing Abhishek’s account**
   - Verify that Abhishek’s role, password, status, and working access are not modified.
   - Confirm the page can show both `Suhas` and `Abhishek S`, and the total changes from `1` to `2` for this scenario.
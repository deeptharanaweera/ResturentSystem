-- ========================================
-- Initial Admin Setup Instructions
-- ========================================

/*
Supabase manages authentication in its own 'auth' schema. 
To create the first admin user, follow these steps:

1. Go to your Supabase Dashboard -> Authentication -> Users.
2. Click "Add User" -> "Create new user".
3. Enter an email and password (e.g., admin@restaurant.com).
4. Uncheck "Send invitation email" if you want to set it manually, or just create it.
5. Once created, copy the 'User ID' (UUID) of the new user.

6. Now, execute the following SQL in the Supabase 'SQL Editor' 
   to assign the 'admin' role to this user:
*/

-- Replace 'YOUR_USER_ID_HERE' with the UUID you copied
INSERT INTO user_roles (user_id, role) 
VALUES ('60939c29-ff86-4338-b438-cca92caab416', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

/*
7. You can now login at /login using those credentials.
8. Once logged in as admin, you can use the 'Staff Management' 
   page to create other accounts (waiters, kitchen staff) 
   directly from the UI.
*/

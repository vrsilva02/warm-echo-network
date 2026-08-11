# Plan: Add manual password change and creation to Access Management

Enable administrators to set or change a user's password directly within the "Gestão de Acessos" module.

## User-facing changes

- **Update User Creation**: The "Convidar usuário" dialog already has an optional password field. I will ensure this field is clearly labeled for manual password setting.
- **New Password Change Feature**: Add a "Alterar Senha" option to the user action list in the "Usuários ativos" tab.
- **Password Change Dialog**: A new modal will allow admins to enter and confirm a new password for an existing user.
- **Visual Feedback**: Success/error toasts when changing or setting passwords.

## Technical details

- **Server Functions**: Update `src/lib/admin-users.functions.ts` to include a `updateUserPassword` server function using `supabaseAdmin.auth.admin.updateUserById`.
- **UI Components**:
    - Modify `src/routes/_authenticated/acessos.tsx` to handle the password change state and modal.
    - Reuse `Input` with visibility toggle for consistency.
- **Security**: Ensure only users with the `admin` role can call these functions.

## Implementation details

1. **`src/lib/admin-users.functions.ts`**:
    - Add `updateUserPassword` server function.
    - Validate role and input.
2. **`src/routes/_authenticated/acessos.tsx`**:
    - Add state for `passwordChangeUser` and `newPassword`.
    - Implement a `handlePasswordChange` function calling the new server function.
    - Add a dialog for password updates.
    - Add an "Alterar Senha" button next to "Editar perfis".
3. **`src/routes/index.tsx`**: Update the top comment.

# Git Setup for Cursor Terminal

## Problem

Git works in your regular terminal but not in Cursor's integrated terminal because Cursor's terminal doesn't have Git in its PATH.

## Solution

### Quick Fix (Current Session Only)

Run this in Cursor's terminal:

```powershell
$env:Path += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
git --version
```

Or run the helper script:

```powershell
.\fix-cursor-git-path.ps1
```

### Permanent Fix Options

#### Option 1: Add to System PATH (Recommended)

1. Press `Win + X` and select **"System"**
2. Click **"Advanced system settings"**
3. Click **"Environment Variables"**
4. Under **"System variables"**, select **"Path"** and click **"Edit"**
5. Click **"New"** and add:
   - `C:\Program Files\Git\bin`
   - `C:\Program Files\Git\cmd`
6. Click **"OK"** on all dialogs
7. **Restart Cursor** for changes to take effect

#### Option 2: Add to User PATH

1. Press `Win + X` and select **"System"**
2. Click **"Advanced system settings"**
3. Click **"Environment Variables"**
4. Under **"User variables"**, select **"Path"** and click **"Edit"**
5. Click **"New"** and add:
   - `C:\Program Files\Git\bin`
   - `C:\Program Files\Git\cmd`
6. Click **"OK"** on all dialogs
7. **Restart Cursor** for changes to take effect

#### Option 3: PowerShell Profile (Session-Based)

Add to your PowerShell profile (`$PROFILE`):

```powershell
# Add Git to PATH
$env:Path += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
```

To edit your profile:
```powershell
notepad $PROFILE
```

## Verify

After applying the fix, verify Git works:

```powershell
git --version
```

You should see: `git version 2.52.0.windows.1` (or similar)

## Current Repository Status

Your repository is ready:
- ✅ Git repository initialized
- ✅ All files committed
- ✅ Remote configured: https://github.com/whact2025/context-first-docs.git
- ✅ Branch: main

## Next Steps

Once Git is accessible in Cursor:

1. **Create repository on GitHub** (if not exists):
   - Go to https://github.com/whact2025
   - Click "New repository"
   - Name: `context-first-docs`
   - Don't initialize with README/gitignore/license

2. **Push to GitHub**:
   ```powershell
   cd C:\Users\richf\context-first-docs
   $env:Path += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"  # If not permanent
   git push -u origin main
   ```
   
   Use a Personal Access Token as password (see `PUSH_TO_GITHUB.md`)

## Helper Scripts

- `fix-cursor-git-path.ps1` - Adds Git to PATH for current session
- `init-and-push.ps1` - Initializes and prepares repository for push
- `setup-and-publish.ps1` - Full setup script

# Publish to GitHub - Step by Step Guide

## Current Situation

- ✅ Project files are ready
- ❌ Git repository not initialized locally
- ❌ Repository doesn't exist on GitHub yet

## Step 1: Install Git (if not installed)

1. Download Git for Windows: https://git-scm.com/download/win
2. Run the installer
3. **Important**: During installation, choose:
   - "Git from the command line and also from 3rd-party software"
   - Use bundled OpenSSH
   - Use the OpenSSL library
   - Checkout Windows-style, commit Unix-style line endings
4. Restart PowerShell/terminal after installation
5. Verify installation: `git --version`

## Step 2: Configure Git (first time only)

Open PowerShell in your project directory and run:

```powershell
cd C:\Users\richf\context-first-docs

# Set your name and email
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Initialize Git Repository

```powershell
# Initialize git repository
git init

# Create main branch
git branch -M main

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Context-first docs system with self-referential documentation"
```

## Step 4: Create Repository on GitHub

1. Go to: https://github.com/whact2025
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name**: `context-first-docs`
   - **Description**: `Context-first collaboration system for agentic development`
   - **Visibility**: Choose Public or Private
   - **IMPORTANT**: Do NOT check:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   (We already have these files)
4. Click **"Create repository"**

## Step 5: Connect Local Repository to GitHub

```powershell
# Add remote repository
git remote add origin https://github.com/whact2025/context-first-docs.git

# Verify remote was added
git remote -v
```

You should see:
```
origin  https://github.com/whact2025/context-first-docs.git (fetch)
origin  https://github.com/whact2025/context-first-docs.git (push)
```

## Step 6: Push to GitHub

### Option A: Using Personal Access Token (Recommended)

1. **Create a Personal Access Token**:
   - Go to: https://github.com/settings/tokens
   - Click **"Generate new token"** → **"Generate new token (classic)"**
   - Name: `context-first-docs`
   - Expiration: Choose your preference
   - **Select scopes**: Check `repo` (Full control of private repositories)
   - Click **"Generate token"**
   - **COPY THE TOKEN** (you won't see it again!)

2. **Push using the token**:
   ```powershell
   git push -u origin main
   ```
   
   When prompted:
   - **Username**: `whact2025` (or your GitHub username)
   - **Password**: Paste your Personal Access Token (not your GitHub password)

### Option B: Using GitHub CLI

```powershell
# Install GitHub CLI (if not installed)
winget install GitHub.cli

# Authenticate
gh auth login

# Push
git push -u origin main
```

## Step 7: Verify

After pushing, visit:
**https://github.com/whact2025/context-first-docs**

You should see:
- ✅ All project files
- ✅ README.md rendering correctly
- ✅ Self-referential documentation (CONTEXT.md, DECISIONS.md, etc.)
- ✅ All source code in `src/` directory
- ✅ CI workflow configured

## Troubleshooting

### "Git is not recognized"
- Git is not installed or not in PATH
- Restart PowerShell after installing Git
- Verify with: `git --version`

### "Repository not found" or "remote origin already exists"
```powershell
# Remove existing remote
git remote remove origin

# Add it again
git remote add origin https://github.com/whact2025/context-first-docs.git
```

### "Authentication failed"
- Make sure you're using a Personal Access Token, not your password
- Verify the token has `repo` scope
- Check the token hasn't expired

### "Failed to push some refs"
- Make sure the repository exists on GitHub (Step 4)
- Try: `git push -u origin main --force` (only if you're sure, this overwrites remote)

### "Nothing to commit"
- Check if files are already committed: `git log`
- If you need to add files: `git add .` then `git commit -m "Your message"`

## Quick Command Reference

```powershell
# Check git status
git status

# See what files are staged
git status --short

# View commit history
git log --oneline

# Check remote configuration
git remote -v

# Push to GitHub
git push -u origin main

# Pull from GitHub (if needed)
git pull origin main
```

## All-in-One Script

If you prefer, you can run these commands in sequence:

```powershell
cd C:\Users\richf\context-first-docs
git init
git branch -M main
git add .
git commit -m "Initial commit: Context-first docs system with self-referential documentation"
git remote add origin https://github.com/whact2025/context-first-docs.git
git push -u origin main
```

(You'll be prompted for authentication during the push step)

---

**Need help?** Check the other guides:
- `QUICK_PUBLISH.md` - Quick reference
- `GITHUB_SETUP.md` - Detailed setup guide
- `PROJECT_ANALYSIS.md` - Project overview

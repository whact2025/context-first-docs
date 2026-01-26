# GitHub Publishing Guide

## Prerequisites

1. **Git must be installed**
   - Download from: https://git-scm.com/download/win
   - During installation, choose "Git from the command line and also from 3rd-party software"
   - Restart your terminal/PowerShell after installation

2. **GitHub account**
   - Ensure you're logged into https://github.com/whact2025
   - You may need a Personal Access Token for authentication

## Quick Start (Automated)

Run the provided PowerShell script:

```powershell
.\publish.ps1
```

Then follow the instructions it provides.

## Manual Steps

### 1. Initialize Git Repository

```powershell
cd C:\Users\richf\context-first-docs
git init
```

### 2. Create the Repository on GitHub

1. Go to https://github.com/whact2025
2. Click "New repository" (or the "+" icon)
3. Repository name: `context-first-docs`
4. Description: "Context-first collaboration system for agentic development"
5. Choose Public or Private
6. **Do NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

### 3. Add Files and Commit

```powershell
git add .
git commit -m "Initial commit: Context-first docs system with self-referential documentation"
```

### 4. Add Remote and Push

```powershell
git branch -M main
git remote add origin https://github.com/whact2025/context-first-docs.git
git push -u origin main
```

### 5. Authentication

If prompted for credentials:

**Option A: Personal Access Token (Recommended)**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "context-first-docs"
4. Select scopes: `repo` (full control of private repositories)
5. Generate and copy the token
6. When prompted for password, paste the token instead

**Option B: GitHub CLI**
```powershell
# Install GitHub CLI if not installed
winget install GitHub.cli

# Authenticate
gh auth login

# Then push
git push -u origin main
```

## Verify

After pushing, visit:
https://github.com/whact2025/context-first-docs

You should see:
- All project files
- Self-referential documentation (CONTEXT.md, DECISIONS.md, etc.)
- README rendering correctly
- ctx blocks visible in the Markdown files

## Next Steps

1. **Set up branch protection** (optional):
   - Go to Settings → Branches
   - Add rule for `main` branch
   - Require pull request reviews

2. **Enable GitHub Actions**:
   - The CI workflow (`.github/workflows/ci.yml`) will run automatically on push
   - Check the Actions tab to see test results

3. **Add topics/tags**:
   - Go to repository Settings → Topics
   - Add: `context`, `documentation`, `agentic`, `markdown`, `collaboration`, `git`

## Troubleshooting

### "Git is not recognized"
- Install Git from https://git-scm.com/download/win
- Restart your terminal/PowerShell
- Verify with: `git --version`

### "Repository not found"
- Ensure the repository exists at https://github.com/whact2025/context-first-docs
- Check you have access to the whact2025 organization
- Verify the repository name matches exactly

### Authentication failures
- Use a Personal Access Token instead of password
- Ensure token has `repo` scope
- Check token hasn't expired

### "Remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/whact2025/context-first-docs.git
```

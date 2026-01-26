# Quick Publish Guide

## Prerequisites

1. **Install Git** (if not already installed):
   - Download from: https://git-scm.com/download/win
   - During installation, choose "Git from the command line and also from 3rd-party software"
   - Restart PowerShell after installation
   - Verify with: `git --version`

2. **GitHub Account Access**:
   - Ensure you have access to https://github.com/whact2025
   - You may need a Personal Access Token (see Authentication section below)

## Quick Start (Automated)

Run the setup script:

```powershell
.\setup-and-publish.ps1
```

Then follow the instructions it provides.

## Manual Steps

If you prefer to do it manually, follow these steps:

### 1. Initialize Git Repository

```powershell
cd C:\Users\richf\context-first-docs
git init
```

### 2. Configure Git User (if not already configured)

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 3. Create the Repository on GitHub

1. Go to https://github.com/whact2025
2. Click "New repository" (or the "+" icon)
3. Repository name: `context-first-docs`
4. Description: `Context-first collaboration system for agentic development`
5. Choose Public or Private
6. **Do NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

### 4. Add Files and Commit

```powershell
git add .
git commit -m "Initial commit: Context-first docs system with self-referential documentation"
```

### 5. Add Remote and Push

```powershell
git branch -M main
git remote add origin https://github.com/whact2025/context-first-docs.git
git push -u origin main
```

## Authentication

If prompted for credentials when pushing:

### Option A: Personal Access Token (Recommended)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "context-first-docs"
4. Select scopes: `repo` (full control of private repositories)
5. Generate and copy the token
6. When prompted for password, paste the token instead

### Option B: GitHub CLI

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

## Project Summary

This project is a **Context-First Docs for Agentic Development** system that:

- Provides a structured, auditable context graph for humans and AI agents
- Uses Markdown as the interface, with context as the source of truth
- Supports docs-style comments and tracked changes (accept/reject)
- Enables bidirectional Markdown ↔ context synchronization
- Is self-referential - uses its own system to document itself

Key files:
- `README.md` - Project overview
- `CONTEXT.md` - Core project context and goals
- `DECISIONS.md` - Architecture decisions with rationale
- `PLAN.md` - Development roadmap and tasks
- `RISKS.md` - Project risks and mitigation strategies
- `QUESTIONS.md` - Open questions needing answers

## Next Steps After Publishing

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

4. **Review the self-referential documentation**:
   - Check how the project uses its own system
   - See `docs/SELF-REFERENCE.md` for details

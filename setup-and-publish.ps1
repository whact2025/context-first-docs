# Enhanced PowerShell script to set up and publish context-first-docs to GitHub
# This script handles git initialization, commit, and provides push instructions

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Context-First Docs - GitHub Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
$gitAvailable = $false
try {
    $gitVersion = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Found: $gitVersion" -ForegroundColor Green
        $gitAvailable = $true
    } else {
        throw "Git not found"
    }
} catch {
    Write-Host "✗ ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git first:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "  2. During installation, choose 'Git from the command line and also from 3rd-party software'" -ForegroundColor White
    Write-Host "  3. Restart PowerShell after installation" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Check if we're in a git repository
if (Test-Path .git) {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
    $repoInitialized = $true
} else {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Repository initialized" -ForegroundColor Green
        $repoInitialized = $true
    } else {
        Write-Host "✗ Failed to initialize repository" -ForegroundColor Red
        exit 1
    }
}

# Check current branch
$currentBranch = git branch --show-current 2>$null
if (-not $currentBranch) {
    Write-Host "Creating main branch..." -ForegroundColor Yellow
    git checkout -b main 2>&1 | Out-Null
    $currentBranch = "main"
} else {
    Write-Host "✓ Current branch: $currentBranch" -ForegroundColor Green
}

# Ensure we're on main branch
if ($currentBranch -ne "main") {
    Write-Host "Switching to main branch..." -ForegroundColor Yellow
    git checkout -b main 2>&1 | Out-Null
    git branch -M main 2>&1 | Out-Null
}

# Check remote configuration
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "✓ Remote already configured: $remote" -ForegroundColor Green
} else {
    Write-Host "Adding remote repository..." -ForegroundColor Yellow
    git remote add origin https://github.com/whact2025/context-first-docs.git
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Remote added" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to add remote" -ForegroundColor Red
        exit 1
    }
}

# Add all files
Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to add files" -ForegroundColor Red
    exit 1
}

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Creating initial commit..." -ForegroundColor Yellow
    $commitMessage = "Initial commit: Context-first docs system with self-referential documentation"
    git commit -m $commitMessage
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Commit created successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create commit" -ForegroundColor Red
        Write-Host "You may need to configure git user:" -ForegroundColor Yellow
        Write-Host "  git config --global user.name 'Your Name'" -ForegroundColor White
        Write-Host "  git config --global user.email 'your.email@example.com'" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "✓ No changes to commit (repository is up to date)" -ForegroundColor Green
}

# Check if we need to push
$localCommits = git rev-list --count origin/main..HEAD 2>$null
if (-not $localCommits) {
    # Try to check if remote exists
    git ls-remote --heads origin main 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $remoteCommits = git rev-list --count HEAD..origin/main 2>$null
        if ($remoteCommits -gt 0) {
            Write-Host "⚠ Remote has commits that local doesn't have" -ForegroundColor Yellow
            Write-Host "  Consider running: git pull origin main" -ForegroundColor White
        } else {
            Write-Host "✓ Repository is in sync with remote" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠ Remote repository may not exist yet" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ready to Push!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run the following command to push to GitHub:" -ForegroundColor Yellow
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""

# Check if repository exists on GitHub
Write-Host "Before pushing, ensure the repository exists:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://github.com/whact2025" -ForegroundColor White
Write-Host "  2. Click 'New repository' (or the '+' icon)" -ForegroundColor White
Write-Host "  3. Repository name: context-first-docs" -ForegroundColor White
Write-Host "  4. Description: 'Context-first collaboration system for agentic development'" -ForegroundColor White
Write-Host "  5. Choose Public or Private" -ForegroundColor White
Write-Host "  6. DO NOT initialize with README, .gitignore, or license (we already have these)" -ForegroundColor White
Write-Host "  7. Click 'Create repository'" -ForegroundColor White
Write-Host ""

Write-Host "Authentication:" -ForegroundColor Yellow
Write-Host "  If prompted for credentials, you'll need a Personal Access Token:" -ForegroundColor White
Write-Host "  1. Go to: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "  2. Click 'Generate new token' → 'Generate new token (classic)'" -ForegroundColor White
Write-Host "  3. Give it a name like 'context-first-docs'" -ForegroundColor White
Write-Host "  4. Select scope: repo (full control of private repositories)" -ForegroundColor White
Write-Host "  5. Generate and copy the token" -ForegroundColor White
Write-Host "  6. When prompted for password, paste the token instead" -ForegroundColor White
Write-Host ""

Write-Host "After pushing, your repository will be available at:" -ForegroundColor Cyan
$repoUrl = 'https://github.com/whact2025/context-first-docs'
Write-Host ('  ' + $repoUrl) -ForegroundColor White
Write-Host ''

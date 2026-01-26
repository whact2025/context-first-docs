# PowerShell script to publish context-first-docs to GitHub
# Run this script from the project root directory

Write-Host "Publishing context-first-docs to GitHub..." -ForegroundColor Cyan

# Check if git is available
try {
    $gitVersion = git --version
    Write-Host "Found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a git repository
if (Test-Path .git) {
    Write-Host "Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
}

# Check current branch
$currentBranch = git branch --show-current
if (-not $currentBranch) {
    Write-Host "Creating main branch..." -ForegroundColor Yellow
    git checkout -b main
}

# Add all files
Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Creating initial commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: Context-first docs system with self-referential documentation"
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}

# Check if remote exists
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "Remote already configured: $remote" -ForegroundColor Green
} else {
    Write-Host "Adding remote repository..." -ForegroundColor Yellow
    git remote add origin https://github.com/whact2025/context-first-docs.git
}

# Ensure we're on main branch
git checkout -b main 2>$null
git branch -M main

Write-Host ""
Write-Host "Ready to push! Run the following command:" -ForegroundColor Cyan
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "If you need to authenticate, you may need to:" -ForegroundColor Yellow
Write-Host "  1. Create a Personal Access Token at https://github.com/settings/tokens" -ForegroundColor White
Write-Host "  2. Use it as your password when prompted" -ForegroundColor White
Write-Host ""

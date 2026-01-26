# All-in-one script to initialize git and prepare for push
# Run this after installing Git and creating the GitHub repository

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Initialize Git Repository and Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
try {
    $null = git --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Git not found" }
    Write-Host "✓ Git is available" -ForegroundColor Green
} catch {
    Write-Host "✗ ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git first:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "  2. Restart PowerShell after installation" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    exit 1
}

# Check if already initialized
if (Test-Path .git) {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to initialize repository" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Repository initialized" -ForegroundColor Green
}

# Ensure we're on main branch
Write-Host "Setting up main branch..." -ForegroundColor Yellow
git branch -M main 2>&1 | Out-Null
Write-Host "✓ Branch set to main" -ForegroundColor Green

# Add all files
Write-Host "Adding files..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to add files" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Files added" -ForegroundColor Green

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Creating initial commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: Context-first docs system with self-referential documentation"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to create commit" -ForegroundColor Red
        Write-Host ""
        Write-Host "You may need to configure git user:" -ForegroundColor Yellow
        Write-Host "  git config --global user.name 'Your Name'" -ForegroundColor White
        Write-Host "  git config --global user.email 'your.email@example.com'" -ForegroundColor White
        exit 1
    }
    Write-Host "✓ Commit created" -ForegroundColor Green
} else {
    Write-Host "✓ No changes to commit" -ForegroundColor Green
}

# Check remote
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

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ready to Push!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Make sure the repository exists on GitHub first:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://github.com/whact2025" -ForegroundColor White
Write-Host "  2. Click 'New repository'" -ForegroundColor White
Write-Host "  3. Name: context-first-docs" -ForegroundColor White
Write-Host "  4. DO NOT initialize with README/gitignore/license" -ForegroundColor White
Write-Host "  5. Click 'Create repository'" -ForegroundColor White
Write-Host ""
Write-Host "Then run this command to push:" -ForegroundColor Yellow
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "When prompted for credentials:" -ForegroundColor Yellow
Write-Host "  Username: whact2025 (or your GitHub username)" -ForegroundColor White
Write-Host "  Password: Use a Personal Access Token (not your password)" -ForegroundColor White
Write-Host ""
Write-Host "Get a token at: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host ""

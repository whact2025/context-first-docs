# Fix Git PATH in Cursor Terminal
# This script adds Git to PATH for the current PowerShell session

Write-Host "Adding Git to PATH for this session..." -ForegroundColor Yellow

# Add Git directories to PATH
$gitBinPath = "C:\Program Files\Git\bin"
$gitCmdPath = "C:\Program Files\Git\cmd"

if (Test-Path $gitBinPath) {
    if ($env:Path -notlike "*$gitBinPath*") {
        $env:Path += ";$gitBinPath"
        Write-Host "✓ Added Git bin to PATH" -ForegroundColor Green
    } else {
        Write-Host "✓ Git bin already in PATH" -ForegroundColor Green
    }
}

if (Test-Path $gitCmdPath) {
    if ($env:Path -notlike "*$gitCmdPath*") {
        $env:Path += ";$gitCmdPath"
        Write-Host "✓ Added Git cmd to PATH" -ForegroundColor Green
    } else {
        Write-Host "✓ Git cmd already in PATH" -ForegroundColor Green
    }
}

# Verify Git is accessible
try {
    $gitVersion = git --version
    Write-Host ""
    Write-Host "✓ Git is now accessible: $gitVersion" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: This only affects the current PowerShell session." -ForegroundColor Yellow
    Write-Host "To make it permanent, add Git to your system PATH or restart Cursor." -ForegroundColor Yellow
} catch {
    Write-Host "✗ Git is still not accessible" -ForegroundColor Red
    Write-Host "Please check your Git installation." -ForegroundColor Yellow
}

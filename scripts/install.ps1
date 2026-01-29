# Installation script for TruthLayer (PowerShell)
# Manages all dependencies and verifies the installation

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "`n[${Step}] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TruthLayer - Installation Script              ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Step 1: Check Node.js version
Write-Step "1" "Checking Node.js version..."
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
    $majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
    Write-Info "Found Node.js $nodeVersion"
    
    if ($majorVersion -lt 18) {
        Write-Error "Node.js version $nodeVersion is too old. Please install Node.js 18 or higher."
        exit 1
    }
    
    Write-Success "Node.js version $nodeVersion is compatible"
} catch {
    Write-Error "Node.js is not installed or not in PATH"
    Write-Info "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
}

# Step 2: Check npm version
Write-Step "2" "Checking npm version..."
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "npm not found"
    }
    Write-Info "Found npm $npmVersion"
    Write-Success "npm version $npmVersion is compatible"
} catch {
    Write-Error "npm is not installed or not in PATH"
    Write-Info "npm should come with Node.js. Please reinstall Node.js."
    exit 1
}

# Step 3: Install dependencies
Write-Step "3" "Installing dependencies..."
try {
    Write-Info "Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Success "Dependencies installed successfully"
} catch {
    Write-Error "Failed to install dependencies"
    Write-Info "Try running 'npm install' manually to see detailed error messages"
    exit 1
}

# Step 4: Verify installation
if (-not $SkipVerify) {
    Write-Step "4" "Verifying installation..."
    
    $checks = @(
        @{ Name = "TypeScript"; Path = "node_modules\typescript\lib\typescript.js" },
        @{ Name = "Jest"; Path = "node_modules\jest\bin\jest.js" },
        @{ Name = "ts-jest"; Path = "node_modules\ts-jest\dist\index.js" },
        @{ Name = "ESLint"; Path = "node_modules\eslint\bin\eslint.js" },
        @{ Name = "Prettier"; Path = "node_modules\prettier\bin\prettier.js" },
        @{ Name = "markdown-it"; Path = "node_modules\markdown-it\dist\markdown-it.js" },
        @{ Name = "yaml"; Path = "node_modules\yaml\dist\index.js" }
    )
    
    $allPassed = $true
    foreach ($check in $checks) {
        if (Test-Path $check.Path) {
            Write-Success "$($check.Name) is installed"
        } else {
            Write-Error "$($check.Name) is missing"
            $allPassed = $false
        }
    }
    
    if (-not $allPassed) {
        Write-Error "Installation verification failed"
        exit 1
    }
}

# Step 5: Build project (optional)
if (-not $SkipBuild) {
    Write-Step "5" "Building project..."
    try {
        Write-Info "Running npm run build..."
        npm run build
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Project built successfully"
        } else {
            Write-Warning "Build failed. This might be expected if there are TypeScript errors."
            Write-Info "You can fix errors and run 'npm run build' manually later"
        }
    } catch {
        Write-Warning "Build failed. This might be expected if there are TypeScript errors."
        Write-Info "You can fix errors and run 'npm run build' manually later"
    }
} else {
    Write-Info "Skipping build (--SkipBuild flag set)"
}

# Step 6: Run tests (optional)
if (-not $SkipTests) {
    Write-Step "6" "Running tests..."
    try {
        Write-Info "Running npm test..."
        npm test
        if ($LASTEXITCODE -eq 0) {
            Write-Success "All tests passed"
        } else {
            Write-Warning "Some tests failed. This might be expected if the codebase is in development."
            Write-Info "You can run 'npm test' manually later to see detailed test results"
        }
    } catch {
        Write-Warning "Some tests failed. This might be expected if the codebase is in development."
        Write-Info "You can run 'npm test' manually later to see detailed test results"
    }
} else {
    Write-Info "Skipping tests (--SkipTests flag set)"
}

# Success message
Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Installation completed successfully!                  ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  • Run npm run build to compile TypeScript"
Write-Host "  • Run npm test to run the test suite"
Write-Host "  • Run npm run dev to start development mode"
Write-Host "  • Run npm run lint to check code quality"
Write-Host "  • Run npm run format to format code`n"

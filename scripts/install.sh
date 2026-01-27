#!/bin/bash
# Installation script for context-first-docs (Bash)
# Manages all dependencies and verifies the installation

set -e  # Exit on error

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Parse command line arguments
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_VERIFY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_step() {
    echo -e "\n${BOLD}${CYAN}[$1]${NC} $2"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo -e "\n${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║${NC}  ${BOLD}Context-First Docs - Installation Script${NC}              ${BOLD}${CYAN}║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"

# Step 1: Check Node.js version
log_step "1" "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed or not in PATH"
    log_info "Please install Node.js 18 or higher from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
log_info "Found Node.js $NODE_VERSION"

if [ "$MAJOR_VERSION" -lt 18 ]; then
    log_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18 or higher."
    exit 1
fi

log_success "Node.js version $NODE_VERSION is compatible"

# Step 2: Check npm version
log_step "2" "Checking npm version..."
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed or not in PATH"
    log_info "npm should come with Node.js. Please reinstall Node.js."
    exit 1
fi

NPM_VERSION=$(npm --version)
log_info "Found npm $NPM_VERSION"
log_success "npm version $NPM_VERSION is compatible"

# Step 3: Install dependencies
log_step "3" "Installing dependencies..."
log_info "Running npm install..."
if npm install; then
    log_success "Dependencies installed successfully"
else
    log_error "Failed to install dependencies"
    log_info "Try running 'npm install' manually to see detailed error messages"
    exit 1
fi

# Step 4: Verify installation
if [ "$SKIP_VERIFY" = false ]; then
    log_step "4" "Verifying installation..."
    
    declare -a CHECKS=(
        "TypeScript:node_modules/typescript/lib/typescript.js"
        "Jest:node_modules/jest/bin/jest.js"
        "ts-jest:node_modules/ts-jest/dist/index.js"
        "ESLint:node_modules/eslint/bin/eslint.js"
        "Prettier:node_modules/prettier/bin/prettier.js"
        "markdown-it:node_modules/markdown-it/dist/markdown-it.js"
        "yaml:node_modules/yaml/dist/index.js"
    )
    
    ALL_PASSED=true
    for check in "${CHECKS[@]}"; do
        NAME=$(echo $check | cut -d: -f1)
        PATH=$(echo $check | cut -d: -f2)
        if [ -f "$PATH" ]; then
            log_success "$NAME is installed"
        else
            log_error "$NAME is missing"
            ALL_PASSED=false
        fi
    done
    
    if [ "$ALL_PASSED" = false ]; then
        log_error "Installation verification failed"
        exit 1
    fi
fi

# Step 5: Build project (optional)
if [ "$SKIP_BUILD" = false ]; then
    log_step "5" "Building project..."
    log_info "Running npm run build..."
    if npm run build; then
        log_success "Project built successfully"
    else
        log_warning "Build failed. This might be expected if there are TypeScript errors."
        log_info "You can fix errors and run 'npm run build' manually later"
    fi
else
    log_info "Skipping build (--skip-build flag set)"
fi

# Step 6: Run tests (optional)
if [ "$SKIP_TESTS" = false ]; then
    log_step "6" "Running tests..."
    log_info "Running npm test..."
    if npm test; then
        log_success "All tests passed"
    else
        log_warning "Some tests failed. This might be expected if the codebase is in development."
        log_info "You can run 'npm test' manually later to see detailed test results"
    fi
else
    log_info "Skipping tests (--skip-tests flag set)"
fi

# Success message
echo -e "\n${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║${NC}  ${BOLD}Installation completed successfully!${NC}                  ${BOLD}${GREEN}║${NC}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${BOLD}Next steps:${NC}"
echo -e "  • Run ${CYAN}npm run build${NC} to compile TypeScript"
echo -e "  • Run ${CYAN}npm test${NC} to run the test suite"
echo -e "  • Run ${CYAN}npm run dev${NC} to start development mode"
echo -e "  • Run ${CYAN}npm run lint${NC} to check code quality"
echo -e "  • Run ${CYAN}npm run format${NC} to format code\n"

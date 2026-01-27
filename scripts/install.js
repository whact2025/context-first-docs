#!/usr/bin/env node
/**
 * Installation script for context-first-docs
 * Manages all dependencies and verifies the installation
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.bright}${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function checkNodeVersion() {
  logStep('1', 'Checking Node.js version...');
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    
    logInfo(`Found Node.js ${nodeVersion}`);
    
    if (majorVersion < 18) {
      logError(`Node.js version ${nodeVersion} is too old. Please install Node.js 18 or higher.`);
      process.exit(1);
    }
    
    logSuccess(`Node.js version ${nodeVersion} is compatible`);
    return true;
  } catch (error) {
    logError('Node.js is not installed or not in PATH');
    logInfo('Please install Node.js 18 or higher from https://nodejs.org/');
    process.exit(1);
  }
}

function checkNpmVersion() {
  logStep('2', 'Checking npm version...');
  
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
    logInfo(`Found npm ${npmVersion}`);
    logSuccess(`npm version ${npmVersion} is compatible`);
    return true;
  } catch (error) {
    logError('npm is not installed or not in PATH');
    logInfo('npm should come with Node.js. Please reinstall Node.js.');
    process.exit(1);
  }
}

function installDependencies() {
  logStep('3', 'Installing dependencies...');
  
  try {
    logInfo('Running npm install...');
    execSync('npm install', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    logSuccess('Dependencies installed successfully');
    return true;
  } catch (error) {
    logError('Failed to install dependencies');
    logInfo('Try running "npm install" manually to see detailed error messages');
    process.exit(1);
  }
}

function verifyInstallation() {
  logStep('4', 'Verifying installation...');
  
  const checks = [
    {
      name: 'TypeScript',
      path: 'node_modules/typescript/lib/typescript.js',
    },
    {
      name: 'Jest',
      path: 'node_modules/jest/bin/jest.js',
    },
    {
      name: 'ts-jest',
      path: 'node_modules/ts-jest/dist/index.js',
    },
    {
      name: 'ESLint',
      path: 'node_modules/eslint/bin/eslint.js',
    },
    {
      name: 'Prettier',
      path: 'node_modules/prettier/bin/prettier.js',
    },
    {
      name: 'markdown-it',
      path: 'node_modules/markdown-it/dist/markdown-it.js',
    },
    {
      name: 'yaml',
      path: 'node_modules/yaml/dist/index.js',
    },
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const fullPath = join(projectRoot, check.path);
    if (existsSync(fullPath)) {
      logSuccess(`${check.name} is installed`);
    } else {
      logError(`${check.name} is missing`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

function buildProject() {
  logStep('5', 'Building project...');
  
  try {
    logInfo('Running npm run build...');
    execSync('npm run build', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    logSuccess('Project built successfully');
    return true;
  } catch (error) {
    logWarning('Build failed. This might be expected if there are TypeScript errors.');
    logInfo('You can fix errors and run "npm run build" manually later');
    return false;
  }
}

function runTests() {
  logStep('6', 'Running tests...');
  
  try {
    logInfo('Running npm test...');
    execSync('npm test', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    logSuccess('All tests passed');
    return true;
  } catch (error) {
    logWarning('Some tests failed. This might be expected if the codebase is in development.');
    logInfo('You can run "npm test" manually later to see detailed test results');
    return false;
  }
}

function main() {
  log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}Context-First Docs - Installation Script${colors.reset}  ${colors.bright}${colors.cyan}║${colors.reset}`);
  log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const skipTests = args.includes('--skip-tests');
  const skipVerify = args.includes('--skip-verify');
  
  try {
    // Step 1: Check Node.js version
    checkNodeVersion();
    
    // Step 2: Check npm version
    checkNpmVersion();
    
    // Step 3: Install dependencies
    installDependencies();
    
    // Step 4: Verify installation
    if (!skipVerify) {
      const verified = verifyInstallation();
      if (!verified) {
        logError('Installation verification failed');
        process.exit(1);
      }
    }
    
    // Step 5: Build project (optional)
    if (!skipBuild) {
      buildProject();
    } else {
      logInfo('Skipping build (--skip-build flag set)');
    }
    
    // Step 6: Run tests (optional)
    if (!skipTests) {
      runTests();
    } else {
      logInfo('Skipping tests (--skip-tests flag set)');
    }
    
    // Success message
    log(`\n${colors.bright}${colors.green}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
    log(`${colors.bright}${colors.green}║${colors.reset}  ${colors.bright}Installation completed successfully!${colors.reset}  ${colors.bright}${colors.green}║${colors.reset}`);
    log(`${colors.bright}${colors.green}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
    
    log(`\n${colors.bright}Next steps:${colors.reset}`);
    log(`  • Run ${colors.cyan}npm run build${colors.reset} to compile TypeScript`);
    log(`  • Run ${colors.cyan}npm test${colors.reset} to run the test suite`);
    log(`  • Run ${colors.cyan}npm run dev${colors.reset} to start development mode`);
    log(`  • Run ${colors.cyan}npm run lint${colors.reset} to check code quality`);
    log(`  • Run ${colors.cyan}npm run format${colors.reset} to format code\n`);
    
  } catch (error) {
    logError(`\nInstallation failed: ${error.message}`);
    process.exit(1);
  }
}

main();

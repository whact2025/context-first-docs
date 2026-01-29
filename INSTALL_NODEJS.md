# Installing Node.js and npm

Node.js is required to run this project. npm (Node Package Manager) comes bundled with Node.js.

## Quick Installation

### Windows

1. **Download Node.js**
   - Visit [https://nodejs.org/](https://nodejs.org/)
   - Download the **LTS (Long Term Support)** version (recommended)
   - Choose the Windows Installer (.msi) for your system (64-bit recommended)

2. **Run the Installer**
   - Double-click the downloaded `.msi` file
   - Follow the installation wizard
   - **Important**: Make sure "Add to PATH" is checked (it should be by default)
   - Click "Install" and wait for completion

3. **Verify Installation**
   - Open a **new** PowerShell or Command Prompt window (important: close and reopen if you had one open)
   - Run these commands:
     ```powershell
     node --version
     npm --version
     ```
   - You should see version numbers (e.g., `v20.10.0` and `10.2.3`)

4. **Install Project Dependencies**
   - Navigate to the project directory:
     ```powershell
     cd c:\Users\richf\truth-layer
     ```
   - Run the install script:
     ```powershell
     node scripts/install.js
     ```
   - Or install manually:
     ```powershell
     npm install
     ```

### Alternative: Using a Package Manager

#### Using Chocolatey (Windows)
If you have Chocolatey installed:
```powershell
choco install nodejs-lts
```

#### Using Winget (Windows 10/11)
```powershell
winget install OpenJS.NodeJS.LTS
```

#### Using Scoop (Windows)
```powershell
scoop install nodejs-lts
```

## Requirements

- **Node.js**: Version 18.0.0 or higher (LTS recommended)
- **npm**: Comes with Node.js (usually version 9.0.0 or higher)

## Troubleshooting

### "node is not recognized"
- **Solution**: Restart your terminal/PowerShell window after installing Node.js
- If that doesn't work, restart your computer
- Verify Node.js is in your PATH: Check `C:\Program Files\nodejs\` exists

### "npm is not recognized"
- npm should come with Node.js
- If missing, reinstall Node.js and make sure "npm" is selected during installation

### Permission Errors
- Try running PowerShell as Administrator
- Or use a Node version manager like `nvm-windows`

### Using Node Version Manager (nvm-windows)

For managing multiple Node.js versions:

1. **Install nvm-windows**
   - Download from: [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
   - Install the `nvm-setup.exe` file

2. **Install Node.js via nvm**
   ```powershell
   nvm install lts
   nvm use lts
   ```

3. **Verify**
   ```powershell
   node --version
   npm --version
   ```

## After Installation

Once Node.js and npm are installed, you can:

1. **Run the install script**:
   ```powershell
   node scripts/install.js
   ```

2. **Or install manually**:
   ```powershell
   npm install
   npm run build
   npm test
   ```

## Need Help?

- Node.js Documentation: [https://nodejs.org/docs/](https://nodejs.org/docs/)
- npm Documentation: [https://docs.npmjs.com/](https://docs.npmjs.com/)
- Project Issues: Check the project's GitHub issues page

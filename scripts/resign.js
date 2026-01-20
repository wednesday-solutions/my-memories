/**
 * After-sign script for electron-builder
 * Re-signs the entire app bundle with a unified ad-hoc signature
 * to fix Team ID mismatch between app binary and Electron Framework
 */
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
    const { appOutDir, packager } = context;
    
    if (packager.platform.name !== 'mac') {
        return;
    }
    
    const appName = packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);
    
    console.log(`[resign] Re-signing app bundle: ${appPath}`);
    
    try {
        // Deep re-sign the entire app bundle with ad-hoc signature
        execSync(`codesign --deep --force --sign - "${appPath}"`, {
            stdio: 'inherit'
        });
        console.log('[resign] App bundle re-signed successfully');
    } catch (error) {
        console.error('[resign] Failed to re-sign app:', error);
        throw error;
    }
};

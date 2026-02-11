/**
 * After-sign script for electron-builder
 * Re-signs embedded native binaries and the app bundle with ad-hoc signature
 * and proper entitlements so they work on downloaded DMGs (quarantine).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
    const { appOutDir, packager } = context;

    if (packager.platform.name !== 'mac') {
        return;
    }

    const appName = packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);
    const resourcesPath = path.join(appPath, 'Contents', 'Resources');
    const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');

    console.log(`[resign] Re-signing app bundle: ${appPath}`);

    const sign = (filePath, withEntitlements = false) => {
        const ent = withEntitlements && fs.existsSync(entitlements)
            ? `--entitlements "${entitlements}"`
            : '';
        execSync(`codesign --force --sign - ${ent} "${filePath}"`, { stdio: 'inherit' });
    };

    try {
        // 1. Sign all dylibs in bin/ first (dependencies must be signed before dependents)
        const binDir = path.join(resourcesPath, 'bin');
        if (fs.existsSync(binDir)) {
            const files = fs.readdirSync(binDir);
            for (const file of files) {
                const filePath = path.join(binDir, file);
                if (file.endsWith('.dylib')) {
                    console.log(`[resign] Signing dylib: ${file}`);
                    sign(filePath);
                }
            }
            // 2. Sign all executables in bin/
            for (const file of files) {
                const filePath = path.join(binDir, file);
                if (!file.endsWith('.dylib') && !file.startsWith('.')) {
                    try {
                        fs.accessSync(filePath, fs.constants.X_OK);
                        console.log(`[resign] Signing binary: ${file}`);
                        sign(filePath, true);
                    } catch {}
                }
            }
        }

        // 3. Sign the watcher binary
        const watcherPath = path.join(resourcesPath, 'watcher');
        if (fs.existsSync(watcherPath)) {
            console.log('[resign] Signing watcher binary');
            sign(watcherPath, true);
        }

        // 4. Re-sign the entire app bundle
        console.log('[resign] Re-signing app bundle');
        execSync(`codesign --deep --force --sign - --entitlements "${entitlements}" "${appPath}"`, {
            stdio: 'inherit'
        });

        console.log('[resign] App bundle re-signed successfully');
    } catch (error) {
        console.error('[resign] Failed to re-sign app:', error);
        throw error;
    }
};

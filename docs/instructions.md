# Instructions

This file contains technical instructions for setting up this app. 

## Developer Instructions

**Platform prerequisites:**
- **All platforms:** Node 16, NPM, Python 3.11 (newer Python with setuptools installed should work as well)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** Visual Studio C++ Build Tools
- **Linux:** `libasound2-dev` (`sudo apt-get install -y libasound2-dev`)

**Setup (run in order):**

1. `git clone https://github.com/jpsteege/captivate.git` — download the repo
2. `git submodule update --init --recursive` — download submodules (includes `node-link`)
3. `git lfs pull` — download large binary assets
4. `npm install` — install all dependencies and build native addons
5. Verify the native artifact exists: `ls release/app/node-link/build/Release/node-link-native.node`
6. `npm start` — run the app in development mode with hot-reloading

**Troubleshooting: `Cannot find module '../build/Release/node-link-native'`**

This error means the `node-link` native addon was not built for the current Electron version. Fix it by running:

```
npm run rebuild-node-link --prefix release/app
```

If that does not resolve it, rebuild from the submodule directly:

```
cd release/app/node-link
node-gyp rebuild
```

Then restart the app with `npm start`.

## Building and Releasing

### Prerequisites

- **GitHub CLI:** Install via `brew install gh` (macOS), then authenticate with `gh auth login` (uses browser — no Personal Access Token needed)
- **Code signing:** A paid Apple Developer Program membership ($99/year) is required for a signed/notarized macOS build. Without it, set the following env var to skip signing:
  ```bash
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  ```
  Users will see a Gatekeeper warning on first launch, which can be bypassed via right-click → Open.

### Steps

1. **Update the version** in `release/app/package.json`

2. **Build the distributable:**
   ```bash
   CSC_IDENTITY_AUTO_DISCOVERY=false npm run package
   ```
   Output is written to `release/build/`.

3. **Create and push a git tag** matching the version:
   ```bash
   git tag v1.x.x
   git push origin v1.x.x
   ```

4. **Create a GitHub Release and upload artifacts:**
   ```bash
   gh release create v1.x.x release/build/*.dmg release/build/*.zip \
     --title "v1.x.x" \
     --notes "Release notes here"
   ```

### Notarization (optional, requires paid Apple Developer account)

Notarization removes the Gatekeeper warning for end users. It only runs in CI (skipped automatically during local builds).

To enable it in GitHub Actions:

1. Update `teamId` in [.erb/scripts/notarize.js](../.erb/scripts/notarize.js) to your Apple Team ID (found at developer.apple.com → Membership)
2. Add two GitHub Actions secrets:
   - `APPLE_ID` — your Apple ID email
   - `APPLE_ID_PASS` — an app-specific password (generated at appleid.apple.com)

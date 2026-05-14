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

# Captivate

<img src="https://github.com/spensbot/captivate/blob/main/design/readme/Thick.png" alt="Captivate Icon" width="150"/>

## Visual & Lighting Synth

[CaptivateSynth.com](https://CaptivateSynth.com)

Captivate generates live visuals and dmx lighting. All synchronized to music.

## Ready to Impress?

Captivate is groundbreaking software that revolutionizes stage lighting and visuals. Music is intuitive, dynamic, and fun. Thanks to captivate, creating a visual experience feels just as good.

Concert quality visuals and lighting that is easy, fun, and dynamic. Captivate is designed to run autonomously, or you can take as much control as you'd like.

Captivate's design was inspired by synthesisers, so you'll find familiar tools like LFO's, midi integration, pads, and randomizers.

## Add Dimension To Your DMX Universe

Configure your dmx universe in minutes.

Tell Captivate which fixtures you have, and where they are located in space.

Add fixtures seamlessly, without the need to update scenes.

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_1_dmx_config.jpg)

## Breathtaking Lighting

With captivate, hundreds of DMX channels boil down to a handful of intuitive parameters

Take control of these parameters live, or automate them with Captivate's familiar, synth-like modulation tools.

Light groups allow you to add complexity as needed

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_2_light_scenes.jpg)

## Stunning Visuals

Combine visualizers and effects in any way to perfect your visual experience

Add your own videos and photos to create something truly unique

Visualizers and effects listen to the parameters from the active light scene so lighing and visuals are automatically synchronized.

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_3_visual_scenes.jpg)

## Streamlined Complexity

With Captivate, you'll forget there are 512 DMX channels running behind then scenes

![Captivate DMX Configurator](https://github.com/spensbot/captivate/blob/main/design/readme/screenshot_4_dmx_console.jpg)

## Addressable LED Control (WLED)

Captivate supports addressable LED strips via [WLED](https://kno.wled.ge/). Add strips in the LED Fixtures tab, position them on the grid, assign them to groups, and they follow your light scenes just like DMX fixtures. Use the LED Out tab to verify per-LED colour output in real time.

**Protocol — DDP vs UDP:**

| | UDP | DDP |
|---|---|---|
| Max LEDs | 490 per strip | Unlimited |
| WLED support | All versions | 0.13+ (recommended) |

Use **DDP** if your WLED firmware is 0.13 or newer — the app detects the version automatically and shows a recommendation when you run *Test Connection*. Fall back to **UDP** only for older firmware or strips larger than 490 LEDs using the older protocol.

## Always Synchronized

With integrated [Ableton Link](https://www.ableton.com/en/link/) technology, captivate can synchronize bpm and phase with [hundreds of music apps](https://www.ableton.com/en/link/products/) across devices.

## Create once, Perform anywhere

Since all dmx channels boil down to the same parameters, captivate scenes can play on any lighting setup. Add and remove fixtures, or change venues with ease.

### Watch the Youtube Video of Captivate 1

[![Captivate Introduction Video](https://img.youtube.com/vi/6ZwQ97sySq0/0.jpg)](https://www.youtube.com/watch?v=6ZwQ97sySq0)

## Community

This app is currently being developed, and therfore no Github Issues can be stated

## Developers

**Platform prerequisites:**
- **All platforms:** Node 16, NPM, Python 3.11 (newer Python with setuptools installed should work as well)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** Visual Studio C++ Build Tools
- **Linux:** `libasound2-dev` (`sudo apt-get install -y libasound2-dev`)

**Setup (run in order):**

1. `git clone https://github.com/spensbot/captivate.git` — download the repo
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

----------------------------------------

This is a fork of the Captivate2 repo by @spensbot. Without his effort before the time vibe coding was a thing, this app wouldn't exist. Visit the original repo on [Github](https://github.com/spensbot/captivate2).

Thanks to [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) for the app boilerplate

[MIT License](https://github.com/spensbot/Captivate2/blob/master/LICENSE)

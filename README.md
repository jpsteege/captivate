# Captivate

<img src="/design/readme/Thick.png" alt="Captivate Icon" width="150"/>

## Visual & Lighting Synth

Captivate generates live visuals and dmx lighting. All synchronized to music.

Captivate is groundbreaking software that revolutionizes stage lighting and visuals. Music is intuitive, dynamic, and fun. Thanks to captivate, creating a visual experience feels just as good.

Concert quality visuals and lighting that is easy, fun, and dynamic. Captivate is designed to run autonomously, or you can take as much control as you'd like.

Captivate's design was inspired by synthesisers, so you'll find familiar tools like LFO's, midi integration, pads, and randomizers.

## Configure your Setup

### DMX or Artnet
Configure your DMX universe in minutes and link it to a DMX controller or Artnet Address.
Tell Captivate which fixtures you have, and where they are located in space using the 2D-grid. Add fixtures seamlessly, without the need to update scenes.
![Captivate DMX Configurator](/design/readme/screenshot_11_config_dmx.png)

### WLED
New to this version is the support of addressable LED strips via [WLED](https://kno.wled.ge/). Connect the WLED controller, specify the LEDS and position the LED strips in the same space as your DMX fixtures. Besides using the 2D-dimensional control, effects such as chasers, strobes and fades can be used as an overlay. Both the UDP and DDP protocols are supported (DDP is recommended)
![Captivate WLED Configurator](/design/readme/screenshot_12_config_wled.png)

### Grouping
Scale fast by putting both your DMX and WLED fixtures into groups and apply settings and scenes at once.
![Captivate DMX Configurator](/design/readme/screenshot_13_config_groups.png)

## Breathtaking Lighting & Visuals

### Lighting Scenes
With captivate, hundreds of DMX channels boil down to a handful of intuitive parameters. Since your fixtures are placed in a 2D-grid, the software automates complex patterns like tunnel effects without the need of defining sequences.
Take control of these parameters live, or automatically loop over predefined ones.
![Captivate Scene Configurator](/design/readme/screenshot_21_scene_params.png)

### Stunning Visuals
Combine visualizers and effects in any way to perfect your visual experience. Add your own videos and photos to create something truly unique.
Visualizers and effects listen to the parameters from the active light scene so lighing and visuals are automatically synchronized.
![Captivate Visuals Generator](/design/readme/screenshot_22_scene_visuals.png)

## Streamlined Complexity
With Captivate, you'll forget there are 512 DMX channels or thousands of LEDs running behind the scenes. To finetune your performance, use the DMX or WLED consoles to read what your individual channels are doing. 
![Captivate DMX Console](/design/readme/screenshot_31_console_dmx.png)
![Captivate WLED Console](/design/readme/screenshot_32_console_wled.png)


## Always Synchronized

### Ableton Link
With integrated [Ableton Link](https://www.ableton.com/en/link/) technology, captivate can synchronize bpm and phase with [hundreds of music apps](https://www.ableton.com/en/link/products/) across devices.

### Advanced Sound Sync (In Development)
Besides of creation your own scenes and sync them with your music, this version contains a preliminairy setup for a full-automated scene. By listening to patterns in your music, the app will recognize drops and reacts to the energy in the song. Follow this project to know when the feature is ready (ideas are welcome!).
![Captivate Audio Analysis](/design/readme/screenshot_41_audio_analysis_vibe.png)

<br>

### Create once, Perform anywhere
Since all dmx channels boil down to the same parameters, captivate scenes can play on any lighting setup. Add and remove fixtures, or change venues with ease.

<br>

### Watch the Youtube Video of Captivate in Action
[![Captivate Introduction Video](https://img.youtube.com/vi/6ZwQ97sySq0/0.jpg)](https://www.youtube.com/watch?v=6ZwQ97sySq0)

<br>

### Community
Feel free to share your ideas via Github Issues

<br>

### Additional Information
Read the files in the documentation folder for more information:
- [Instructions.md](/docs/instructions.md)
- [Architecture.md](/docs/architecture.md)

<br>
_________________________________

### Credits
This is a fork of the [Captivate](https://github.com/spensbot/captivate) repo by [@spensbot](https://github.com/spensbot). Without his effort, this app wouldn't exist. Visit the website [CaptivateSynth.com](https://CaptivateSynth.com) to learn more about the original project.
Also thanks to [@fwcd](https://github.com/fwcd) for this updates to the original project, which are incorporated in this version. Visit his repo on [Github](https://github.com/fwcd/captivate)

Thanks to [electron-react-boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate) for the app boilerplate

[MIT License](https://github.com/spensbot/Captivate2/blob/master/LICENSE)

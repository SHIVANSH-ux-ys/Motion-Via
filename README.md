## Welcome to Motion Via!

Motion Via is a fun web experiment where you can play around with floating 3D particles using just your webcam and microphone.You don't need a controller or a keyboard to interact with it-you just use your hands and your voice!

## What can you do with it?

1. **Hand Tracking: ** We use your webcam to track your hands.
      **Left Hand:** Open and close your hand to spread the particles out or bring them closer together.
      **Right Hand:** Move your wrist around to gently spin the whole scene.
      **Both Hands:** Pinch with both hands at the same time to reset the camera zoom.

2. **Voice Commands:** Turn on your mic and try talking to it! You say  things like "galaxy","red","more particle",or"zoom in" to change how things look without clicking a button.
3. **Audio Reactivity:**Turn this on and the particles will actually "listen" and react to the sounds around you, pulsing along to background music or noise.
4. **A bunch of shapes:** You can arrange the particles into all kinds of cool shapes-like a heart, a flower,a wave,or a floating donut.

## How to try it out on your computer

Because this project needs to access your webcam and microphone to work,it has to run on a secure server.Don't worry, it's easy to spin one up locally on your computer!

**Step 1:** Open your terminal in this project foler.
**Step 2:** Start a quick local server.If you have Python installed, you can just run this command: ```bash
python3 -m http.server 3000
```
*(If you prefer Node.js,`npx serve` works perfectly too!)*

**Step 3:** Open up your web browser and go to `https://localhost:3000`.
**Step 4:** The browser will ask for permission to use your camera and microphone.Click **Allow** so the app can see your hands and hear your voice commands.

*Pro tip: For the voice commands to work best,we highly recommend using Google Chrome or Microsoft Edge!*

## Controls & Shortcuts

If you prefer to click or use your keyboard, here are some handy shortcuts:
*  `Tab` : Hide or show the settings menu.
*  `P`. : Take a quick screenshot.
*  `O`  : Turn on mouse/touch drag controls so you can click and spin the  camera.
*  `V`  : Turn Voice Commands on or off.
*  `Scroll Wheel` : Zoom in and out.

And here are some examples of **voice commands** you can try when the mic is listening:
*   **Shapes:** "galaxy","heart","dna","cube","wave","donut","bottle"
*   **Colors:** "pink","rainbow","cyan","gold","white"
*   **Movement:** "pause","slow","fast","hyper"
*  **Tweaks:** "more particles", "less particles","zoom in","explode", "reset"

## What's powering this?
If you're curious about the code under the hood,here is what makes it work:
*   Standard HTML,CSS, and JavaScript.
*   **Three.js** draws all the 3D particles and handles the graphics.
*   ** MediaPipe** is the machine learning magic that tracks your hand movements.
*   Built-in browser features (Web Speech API & Web Audio API) handle the voice and sound effects.

*** Build with ❤️ for Hackclub, by Shivansh Goel ***


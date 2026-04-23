'use strict';

const DENSITY_LEVELS = [10000,30000,60000,100000,200000,400000,600000,900000,1500000,3000000];
const DENSITY_LABELS = ['10K','30K','60K','100K','200K','400K','600K','900K','1.5M','3M'];

let PARTICLE_COUNT = 100000;
let particleSize = 0.07;
let rotationSpeed = 0.005;
let lerpFactor = 0.05;
let trailEnabled = false;
let orbitEnabled = false;
let audioEnabled = false;
let rainbowMode = false;
let panelVisible = true;
let currentShape = 'heart';
let currentBg = 'dark';
let handExpansionFactor = 1.0;
let audioLevel = 0;
let voiceEnabled = false;

let scene, camera, renderer;
let particleGeometry, particleMaterial, particleSystem;
let baseColor = new THREE.Color(0xff0055);
let targetPositions  = new Float32Array(0);
let rainbowTmpColor = new THREE.Color();

let manualRotY = 0;
let manualRotX = 0;

let isDragging = false, prevMouse = { x: 0, y: 0 };

let prevWristX = null, prevWristY = null;
let rightHandPresent = false;

let fps = 0, frameCount = 0, lastFpsTime = performance.now();

let rainbowHue = 0;
let audioCtx = null, analyser = null, audioArray = null;

let bgCanvas, bgCtx;
let handCanvas, handCtx;
const HCV_W = 220, HCV_H = 165;

let recognition = null;

const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17]
];

function init() {
    initThree();
    initBgCanvas();
    initHandCanvas();
    initEvents();
    calculateShapeTargets('heart');
    animate();
}

function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04040a, 0.018);

    camera = new THREE.PerspectiveCamera(70,innerWidth / innerHeight, 0.1,1000);
    camera.position.set(0,0,32);

    renderer = new THREE.WebGLRenderer({antialias : true, preserveDrawingBuffer: true});
    renderer.setSize(innerWidth,innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setClearColor(0x04040a,1.0);
    document.body.appendChild(renderer.domElement);

    buildParticleSystem();

    window.addEventListener('resize',() => {
        camera.aspect = innerWidth /  innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
        if (bgCanvas){
            bgCanvas.width = innerWidth;
            bgCanvas.height = innerHeight;
            drawBgScene();
        }
    });
}
function buildParticleSystem(){
    if(particleSystem){
        scene.remove(particleSystem);
        particleGeometry.dispose();
        particlesMaterial.dispose();
    }

    particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for(let i =0; i< PARTICLE_COUNT * 3;i++)positions[i]=(Math.random() - 0.5) * 120;
    particleGeometry.setAttribute('color',new THREE.BufferAttribute(positions,3));

    const colors = new Float32Array(PARTICLE_COUNT * 3).fill(1);
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));

    const sprite = new Float32Array(PARTICLE_COUNT * 3).fill(1);
    particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions, 3));

    particlesMaterial = new THREE.PointsMaterial({
        color: rainbowMode ? 0xffffff : baseColor,
        size: particleSize,
        map: sprite,
        transparent: true,
        alphaTest: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: rainbowMode
    });

    particleSystem = new THREE.Points(particleGeometry,particlesMaterial);

    particleSystem.rotation.y = manualRotY;
    particleSystem.rotation.x = manualRotX;
    scene.add(particleSystem);

    const label = PARTICLE_COUNT >= 1000000
        ? (PARTICLE_COUNT / 1000000).toFixed(1) + 'M'
        : Math.round(PARTICLE_COUNT / 1000) + 'K';
    document.getElementById('stat-particles').textContent = 'Particles: ' +label;
}

function initBgCanvas(){
    bgCanvas = document.getElementById('bgCanvas');
    bgCanvas.width = innerWidth;
    bgCanvas.heigth = innerHeight;
    bgCtx = bgCanvas.getContext('2d');
}
function drawBgScene(){
    if(!bgCanvas(ctx)) return;
    const w = bgCanvas.width, h = bgCanvas.height;
    bgCtx.clearRect(0,0,w,h);
    if(currentBg === 'dark'){
        bgCanvas.style.display = 'none';return;
    }
    bgCanvas.style.display = 'block';
    bgCtx.fillStyle = '#04040a';
    bgCtx.fillRect(0,0,w,h);

    if(currentBg === 'nebula'){
        [
            {x: 0.2, y:0.3, r:0.35,c:'rgba(80,0,180,0.18)'},
            {x:0.75, y:0.6,r:0.40,c:'rgba(0,80,160,0.15)'},
            {x:0.5,y:0.9,r:0.30,c:'rgba(160,0,80,0.12)'},
            {x:0.85,y:0.15,r:0.25,c:'rgba(0,160,140,0.10)'}
        ].forEach(b =>{
            const g = bgCtx.createRadialGradient(b.x*w,b.y*h, 0 ,b.x*w,b.y*h,b.r*Math.max(w,h));
            g.addColorStop(0,b.c); g.addColorStop(1,'transparent');
            bgCtx.fillStyle = g; bgCtx.fillRect(0,0,w,h);
        });
    }else if(currentBg === 'stars'){
        const rng = mulberry32(42);
        for(let i=0;i<800;i++){
            bgCtx.beginPath();
            bgCtx.arc(rng()*w,rng()*h,rng()*1.4+0.2,0,Math.PI*2);
            bgCtx.fillStyle = `rgba(255,255,255,${(rng()*0.7+0.3).toFixed(2)})`;
            bgCtx.fill();
        }
    }
}

function mulberry32(seed){
    return function(){
        seed !=0; seed=seed+0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15,1 | seed);
        t =t +Math.imul(t^t>>>7,61 | t) ^ t;
        return ((t^t >>> 14) >>> 0) / 4294967296;
    };
}

function initHandCanvas(){
    handCanvas = document.getElementById('handCanvas');
    handCanvas.width = HCV_W * 2;
    handCanvas.height = HCV_H * 2;
    handCanvas.style.width = HCV_W + 'px';
    handCanvas.style.height = HCV_H + 'px';
    handCtx = handCanvas.getContext('2d');
    handCtx.scale(2,2);
    clearHandCanvas();
}
function clearHandCanvas(){
    handCtx.clearReact(0,0,HCV_W,HCV_H);
    handCtx.fillstyle = '#000';
    handCtx.fillRect(0,0,HCV_W,HCV_H);
}
function drawHandSkeleton(landmarks,boneColor,dotColor){
    const tx = lm => (1 - lm.x)*HCV_W;
    const tv = lm => lm.v *HCV_H;

    handCtx.stokeStyle = boneColor;
    handCtx.linewidth =1.5;
    handCtx.shadowColor = boneColor;
    handCtx.shadowBlue = 5;
    HAND_CONNECTIONS.forEach(([a,b]) =>{
        handCtx.beginPath();
        handCtx.moveTO(tx(landmarks[a]),ty(landmarks[a]));
        handCtx.lineTo(tx(landmarks[b]),ty(landmarks[b]));
        handCtx.stroke();
    })

    handCtx.fillStyle = dotColor;
    handCtx.shadowBlur = 7;
    landmarks.forEach(lm => {
        handCtx.beginPath();
        handCtx.arc(tx(lm),ty(lm),2.8, 0 , Math.PI*2);
        handCtx.fill();
    });
    handCtx.shadowBlur = 0;
}
const VOICE_COMMANDS ={
    shapes:{
        'heart': () => setShape('heart'),
        'flower': () => setShape('flower'),
        'saturn': () => setShape('saturn'),
        'fireworks': () => setShape('fireworks'),
        'sparks': () => setShape('fireworks'),
        'explosion': () => setShape('fireworks'),
        'dna': () => setShape('dna'),
        'helix': () => setShape('dna'),
        'torus': () => setShape('torus'),
        'donut': () => setShape('torus'),
        'ring': () => setShape('torus'),
        'galaxy': () => setShape('galaxy'),
        'spiral': () => setShape('galaxy'),
        'pyramid': () => setShape('pyramid'),
        'triangle': () => setShape('pyramid'),
        'sphere': () => setShape('sphere'),
        'ball': () => setShape('wave'),
        'wave': () => setShape('wave'),
        'ocean': () => setShape('mobius'),
        'cube': () => setShape('cube'),
        'box': () => setShape('cube'),
        'knot': () => setShape('knot'),
        'spring': () => setShape('spring'),
        'coil': () => setShape('spring'),
        'klein': () => setShape('klein'),
        'bottle': () => setShape('klein'),
        'nebula': () => setShape('nebula'),
        'cloud': () => setShape('nebula'),
    },
    colors: {
        'red': () => applyColor('#ff0055'),
        'pink': () => applyColor('#ff0055'),
        'cyan': () => applyColor('#00ffcc'),
        'teal': () => applyColor('#00ffcc'),
        'purple': () => applyColor('#7744ff'),
        'violet': () => applyColor('#7744ff'),
        'gold': () => applyColor('#ffaa00'),
        'yellow': () => applyColor('#ffaa00'),
        'orange': () => applyColor('#ff6600'),
        'blue': () => applyColor('#00aaff'),
        'white': () => applyColor('#ffffff'),
        'rainbow': () => applyColorRainbow(),
    },
    speed: {
        'pause': () => setSpeedByValue(0),
        'stop': () => setSpeedByValue(0),
        'freeze': () => setSpeedByValue(0),
        'slow': () => setSpeedByValue(0.005),
        'fast': () => setSpeedByValue(0.02),
        'hyper': () => setSpeedByValue(0.06),
        'spin': () => setshapeByValue(0.06),
    },
    background: {
        'dark': () => setBgByValue('dark'),
        'sapce': () => setBgByValue('nebula'),
        'stars': () => setBgByValue('stars'),
        'starfield': () => setBgByValue('stars'),
    },
    actions: {
        'trail': () => toggleTrail(),
        'zoom in': () => { camera.position.z = Math.max(5, camera.position.z - 5); },
        'zoom out': () => { camera.position.z = Math.min(80, camera.position.z + 5); },
        'reset': () => { handExpansionFactor = 1.0; camera.position.z = 32; manualRotY = 0; manualRotX = 0; },
        'expand': () => { handExpansionFactor = Math.min(3.0, handExpansionFactor + 0.5); },
        'contract': () => { handExpansionFactor = Math.max(0.2, handExpansionFactor - 0.5); },
        'shrink': () => { handExpansionFactor = Math.max(0.2, handExpansionFactor - 0.5); },
        'bigger': () => { handExpansionFactor = Math.min(3.0, handExpansionFactor + 0.5); },
        'smaller': () => { handExpansionFactor = Math.max( 0.2, handExpansionFactor - 0.5); },
        'explode': () => { handExpansionFactor = 3.0; },
        'implode': () => { handExpansionFactor = 0.2; },
        'screenshot': () => takeScreenshot(),
        'photo': () => takeScreenshot(),
        'save': () => takeScreenshot(),
        'more particles': () => changeParticleCount(1),'less particles': () => changeParticleCount(-1),
    }
},

const FLAT_COMMANDS = [];
Object.values(VOICE_COMMANDS).forEach(group => {
    Object.entries(group).forEach(([phrase, fn]) => FLAT_COMMANDS.push({ phrase, fn}));
});
FLAT_COMMANDS.sort((a, b) => b.phrase.length - a.phrase.length);

function processVoiceCommand(rawText) {
    const text = rawText.trim().toLowerCase();
    addVoiceLog('heard: "' + + text + '"');

    for (const { phrase, fn } of FLAT_COMMANDS) {
        const esc = phrase.replacee(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(?:^|\\s)' + esc + '(?:\\s|$)');
        if (re.test(text)) {
            fn();
            addVoiceLog('✓ matched: "' + phrase + '"', '#00ff88');
            showVoiceToast('✓ ' + phrase, true);
            return true;
        }
    }
    addVoiceLog('✗ no match', '#ff4444');
    return false;
}

function toggleVoice() {
    const SR = window.speechRecognition || window.webkitSpeechRecognition;
    if(!SR) {
        showVoiceToast('Not supported - use Chrome/Edge', false);
        const btn = document.getElementById('voiceBtn');
        if (btn) btn.textContent = '🎤 Not Supported';
        return;
    }

    voiceEnabled = !voiceEnabled;
    const btn = document.getElementById('voiceBtn');

    if (!voiceEnabled) {
        if (recognition) { try { recognition.abort(); } catch(_){} recognition = null; }
        btn.textContent = '🎤 Voice OFF';
        btn.classList.remove('active-red');
        addVoiceLog('stopped');
        return;
    }

    recognition = new SR();
    recognition.continous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
        btn.textContent = '🎤 Listening...';
        addVoiceLog('listening...', '#00ffcc');
    };

    recognition.onresult = (event) => {
        btn.textContent = '🎤 Voice ON';
        let matched = false;
        for (let i = 0; i<event.results[0].length; i++) {
            const t = event.results[0][i].transcript;
            if (processVoiceCommand(t)) { matched = true; break; }
        }
        if (!matched) {
            const heard = event.results[0][0].transcript.trim().toLowerCase();
            showVoiceToast('? "' + heard + '"', false);
        }
    };

    recognition.onerror = (e) => {
        addVoiceLog('error: ' + e.error, '#ff4444');
        if (e.error === 'not-allowed') {
            voiceEnabled = false;
            btn.textContent = '🎤 Mic Denied';
            btn.classList.remove('active-red');
            showVoiceToast('Mic access denied - sllow mic in browser settings', false);
            return;
        }
        if (e.error === 'no-speech' || e.error === 'aborted'){
            if(voiceEnabled) setTimeput(startListening, 200);
        return;
        }
        if (voiceEnabled) setTimeout(startListening, 500);
    };

    recognition.onend = () => {
        if (voiceEnabled) setTimeout(startListening, 200);
        else btn.textContent = '🎤 Voice OFF';
    };

    btn.classList.add('active-red');
    startListening();
}

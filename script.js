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
}

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

function startListening() {
    if (!voiceEnaled || !recognition) return;
    try {
        recognition.start();
    } catch(e) {
        if (e.name === 'InvalidStateError') {

        } else {
            addVoiceLog('start error: ' + e.message, '#ff4444');

            setTimeout(toggleVoice, 1000);
        }
    }
}

const MAX_LOG = 6;
let voiceLogs = [];
function addVoiceLog(msg, color) {
    const ts = new Date().toLocateTimeString('en', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    voiceLogs.unshift({ msg, color: color || 'rgba(255,255,255,0.45)',ts });
    if (voiceLogs/length > MAX_LOG) voiceLogs.pop();
    renderVoiceLog();
}
function renderVoiceLog() {
    const el = document.getElementById('voice-log');
    if (!el) return;
    el.innerHTML = voiceLogs.map(l =>
        `<div style="color:${l.color}>${l.ts} ${l.msg}</div>`
    ).join('');
}

let toastTimer = null;
function showVoiceToast(text, success) {
    let toast = document.getElementById('voice-toast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'voice-toast';
        toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);' +
            'background:rgba(0,0,0,0.9);border:1px solid rgba(255,255,255,0.15);' +
            'color:#e8e8f0;font-family:"Space Mono",monospace;font-size:0.75rem;' +
            'padding:9px 20px;border-radius:20px;z-index:200;pointer-events:none;' +
            'transition:opacity 0.3s;white-space:nowrap;';
        document.body.appendChild(toast);
    }
    toast.textContent = '🎤 ' + text;
    toast.style.content = '1';
    toast.style.borderColor = success === true ? 'rgba(0,255,136,0.5)' :
                                success === false ? 'rgba(255,80,80,0.5)' :
                                'rgba(255,255,255,0.15)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function applyColor(hex) {
    rainbowMode = false;
    if (!particlesMaterial) return;
    particlesMaterial.vertexColors = false;
    particlesMaterial.needsUpdate = true;
    document.getElementById('colorPicker').value = hex;
    baseColor.set(hex);
    particlesMaterial.color.set(hex);
    document.querySelectorAll('.present-dot').forEach(d => d.classList.remove('active'));
    const match = document.querySelector('.preset-dot[data-color="' + hex + '"]');
    if (match) match.classList.add('active');
}

function applyColorRainbow() {
    rainbowMode = true;
    if (!particlesMaterial) return;
    particlesMaterial.vertexColors = true;
    particlesMaterial.needsUpdate = true;
    document.querySelectorAll('.preset-dot').forEach(d.classList.remove('active'));
    const rb = document.querySelector('.present-dot[data-color="rainbow"]');
    if (rb) rb.classList.add('active');
}

function setSpeedByValue(s) {
    rotationSpeed = s;
    const rows = document.querySelectorAll('.speed-row');
    if (!rows[0]) return;
    const btns = rows[0].querySelectorAll('.speed-btn');
    const vals = [0, 0.005, 0.02, 0.06];
    btns.forEach((b, i) => {
        b.classList.toggle('active', vals[i] === s);
    });
}

function setBgByValue(mode) {
    currentBg = mode;
    if (mode === 'dark') {
        scene.fog = new THREE.FogExp2(0x4040a,
            parseFloat(document.getElementById('fogSlider').value) / 1000);
        if (bgCanvas) bgCanvas.style.display = 'none';        
    } else {
        scene.fog = null;
        drawBgScene();
    }
}

function changeParticleCount(dir) {
    const slider = document.getElementByIt('densitySlider');
    const next = Math.max(1, Math.min(1, parseInt(slider.value) + dir));
    slider.value = next;
    slider.dispatchEvent(new Event('input'));
}

function calculateShapeTargets(type) {
    const P = PARTICLE_COUNT;
    targetPositions = new Float32Array(P * 3);
    const TAU = Math.PI * 2;

    for (let i = 0; i < P; i++) {
        let x = 0, y = 0, z = 0;

        switch (type) {
            case 'heart': {
                const t = Math.random() * TAU;
                const r = Math.cbrt(Math.random());
                x = 16 * Math.pow(Math.sin(t), 3) * 1.5 * r;
                y = (13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)) * 1.5 * r;
                z = (Math.random()-0.5)*3 + (rr/6)*Math.sin(theta*8);
                break;
            }
            case 'flower': {
                const theta = Math.random() * TAU;
                const rr = Math.cos(5 * theta) * 15;
                x = rr * Math.cod(theta);
                y = rr * Math.sin(theta);
                z = (Math.random()-0.5)*3 + (rr/6)*Math.sin(theta*8);
                break;
            }
            case 'saturn': {
                if (Math.random() < 0.55) {
                    const phi = Math.acos(-1 + (2*i) / (P*0.55));
                    const theta = Math.sqrt(P*0.55*Math.PI) * phi;
                    const rad = 8;
                    x = rad * Math.cos(theta) * Math.sin(phi);
                    y = rad * Math.sin(theta) * Math.sin(phi);
                    z = rad * Math.cos(phi);
                } else {
                    const a = Math.random() * TAU;
                    const d = 11 + Math.random()*9;
                    x = d*Math.cos(a); z = d*Math.sin(a); y = (Math.random()-0.5)*1.2;
                    const tilt = 0.42;
                    const ty = y*Math.cos(tilt) - z*Math.sin(tilt);
                    z = y*Math.sin(tile) + z*Math.cos(tilt); y = ty;
                }
                break;
            }
            case 'fireworks': {
                const theta = TAU * Math.random();
                const phi = Math.acos(2*Math.random()-1);
                const rr = [4,8,13,18,22][Math.floor(Math.random()*5)] + (Math.random()-0.5)*2;
                x = rr*Math.sin(phi)*Math.cos(theta);
                y = rr*Math.sin(phi)*Math.sin(theta);
                z = rr*Math.cos(phi);
                break;
            }
            case 'dna': {
                const h = (Math.random()-0.5)*40;
                const a = h * 0.5;
                const strand = Math.random() > 0.5 ? 0 : Math.PI;
                x = 5*Math.cos(a+strand) + (Math.random()-0.5)*0.7;
                z = 5*Math.sin(a+strand) + (Math.random()-0.5)*0.7;
                y = h;
                if (Math.random() < 0.07) {
                    const t2 = Math.random();
                    x = 5*Math.cos(a)*(1-t2) + 5*Math.cos(a+Math.PI)*t2;
                    z = 5*Math.sin(a)*(1-t2) + 5*Math.sin(a+Math.PI)*t2;
                } 
                break;
            }
            case 'torus': {
                const u = Math.random()*TAU, v = Math.random()*TAU;
                const R = 12, r = 4;
                x = (R+r*Math.cod(v))* Math.cos(u);
                y = (R+r*Math.cos(v))*Math.sin(u);
                z = r*Math.sin(v);
                break;
            }
            case 'galaxy': {
                const arm = Math.floor(Math.random()*3);
                const ao = (arm/3)*TAU;
                const rad = Math.random()*22;
                const sp = rad*0.15;
                x = rad*Math.cos(rad*0.7+ao) + (Math.random()-0.5)*sp*2;
                z = rad*Math.sin(rad*0.7+ao) + (Math.random()-0.5)*sp*2;
                y = (Math.random()-0.5)*Math.max(0, 7-rad*0.35);
                break;
            }
            case 'pyramid': {
                const H = 28, B = 10;
                y = (Math.random()-0.5)*H;
                const sc = 1 - ((y+H/2)/H);
                x = (Math.random()*2-1)*B*sc;
                z = (Math.random()*2-1)*B*sc;
                break;
            }
            case 'sphere': {
                const theta = TAU*Math.random(), phi = Math.acos(2*Math.random()-1);
                const rr = 14 + (Math.random()-0.5)*1.5;
                x = rr*Math.sin(phi)*Math.cos(theta);
                y = rr*Math.sin(phi)*Math.sin(theta);
                z = rr*Math.cos(phi);
                break;
            }
            case 'wave': {
                x = (Math.random()-0.5)*42;
                z = (Math.random()-0.5)*42;
                y = Math.sin(x*0.38)*Math.cos(z*0.38)*9 + (Math.random()-0.5)*0.5;
                break;
            }
            case 'mobius': {
                const u= Math.random()*TAU, v=(Math.random()-0.5)*6;
                const R =12;
                x =(R+v*Math.cos(u/2))*Math.cos(u);
                y =(R+v*Math.cos(u/2))*Math.sin(u);
                z = v*Math.sin(u/2);
                break;
            }
            case 'cube': {
                const face = Math.floor(Math.random()*6);
                const a2 = (Math.random()-0.5)*20, b2= (Math.random()-0.5)*20, c2 =10;
                if ( face === 0){x=a2;y=b2;z=c2;}
                else if (face===1){x =a2;y=b2;z=c2;}
                else if (face ===2){x = a2;y=c2;z=b2;}
                else if(face ===3){x =a2;y=-c2;z=b2;}
                else if(face ===4){x =c2;y=a2;z=b2;}
                else              {x = -c2;y = a2;z=b2;}
                break;
            }
            case 'knot': {
                const t = (i/P)*TAU;
                x =(2+Math.cos(3*t))*Math.cos(2*t)*7 + (Math.random()-0.5)*0.4;
                y =(2+Math.cos(3*t))*Math.sin(2*t)*7 + (Math.random()-0.5)*0.4;
                z = Math.sin(3*t)*7    +(Math.random()-0.5)*0.4;
                break;          
            
            }
            case 'spring' :{
                const turns = 8;
                const t = (i/P)*turns*TAU;
                x = 8*Math.cos(t) + (Math.random()-0.5)*0.5;
                z =8*Math.sin(t) + (Math.random()-0.5)*0.5;
                y =(t/(turns*TAU) - 0.5)*30;
                break;
            }
            case 'klein': {
                const u = Math.random()*TAU,v=Math.random()*TAU;
                const Rk = 6;
                if(u < Math.PI){                x  = (Rk+Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v))*Math.cos(u);
                y = (Rk+Math.cos(u/2)*Math.sin(v)-Math.sin(u/2)*Math.sin(2*v))*Math.sin(u);
            } else {
                x = (Rk + Math.cos(u/2)*Math.sin(v)+Math.sin(u/2)*Math.sin(2*v))*Math.cos(u);
                y = (Rk + Math.cos(u/2)*Math.sin(v)+Math.sin(u/2)*Math.sin(2*v))*Math.sin(u);
                z = -Math.sin(u/2)*Math.sin(v)+Math.cos(u/2)*Math.sin(2*v);
            }
            break;


            }
            case 'nebula' : {
                const offs =[[0,0,0],[8,-4,3],[-7,5,-2],[3,8,-6],[-5,-6,4]];
                const [ox,oy,oz] = offs[Math.floor(Math.random()*5)];
                const r3 = Math.cbrt(Math.random())*7;
                const phi = Math.acos(2*Math.random()-1);
                const th = Math.random()*TAU;
                x = ox+r3*Math.sin(phi)*Math.cos(th);
                y= oy + r3* Math.sin(phi)*Math.sin(th);
                z = oz + r3*Math.cos(phi);
                break;
            }
            default:{
                x = (Math.random()-0.5)*30;
                y = (Math.random()-0.5)*30;
                z =(Math.random()-0.5)*30;
            }
        }
        targetPositions[i*3] = x;
        targetPositions[i*3+1] = y;
        targetPositions[i*3+2] = z;

    }
}

function animate (){
    requestAnimationFrame(animate);
    frameCount++;
    const now = performance.now();
    if (now -  lastFpsTime >= 1000){
        fps = frameCount;
        frameCount =0;
        lastFpsTime = nowl
        document.getElementById('stat-fps').textContent = 'FPS: ' + fps;
    }

    if (audioEnabled && analyser){
        analyser.getByteFrequencyData(audioArray);
        let sum = 0;
        for (let j=0;j<audioArray.length;j++) sum+= audioArray[j];
        audioLevel = sum / audioArray.length / 128;
        handExpansionFactor += (0.5 + audioLevel * 2.5 - handExpansionFactor) * 0.15;
        document.getElementById('audioLevel').textContent = ( audioLevel*100).toFixed(0) +'%';
        document.getElementById('audio-bar-fill').style.width =Math.min(100, audioLevel*100) + '%';
    }

    if(rainbowMode && particleGeometry){
        rainbowHue = (rainbowHue + 0.4) % 360;
        const cols = particleGeometry.attributes.color.array;
        const step =360 / PARTICLE_COUNT;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            rainbowTmpColor.setHSL(((rainbowHue + i*step) % 360) / 360, 1.0, 0.6);
            cols[i*3] = rainbowTmpColor.r;
            cols[i*3+1] = rainbowTmpColor.g;
            cols[i*3+2] = rainbowTmpColor.b;
        }
        particleGeometry.attributes.color.needsUpdate = true;
    }
    if (particleGeometry && targetPositions.length === PARTICLE_COUNT.COUNT * 3) {
        const pos = particleGeometry.attributes.position.array;
        const ef = handExpansionFactor;
        const lf = lerpFactor;
        const len = PARTICLE_COUNT * 3;
        for (let i = 0; i < len; i++) {
            pos[i] += (targetPositions[i] * ef - pos[i]) * lf;
        }
        particleGeometry.attributes.position.needsUpdate = true;
    }
    if (!rightHandPresent && !isDragging) {
        manualRotY += rotationSpeed;
    }
    if (particleSystem) {
        particleSystem.rotation.y = manualRotY;
        particleSystem.rotation.x = manualRotX;
    }
    const pct = ((handExpansionFactor - 0.2) / 2.8) * 100;
    document.getElementById('hand-bar-fill').style.height = Math.min(100, Math.max(2, pct)) + '%';
    document.getElementById('hand-pct').textContent = Math.round(pct) + '%';
    renderer.render(scene, camera);
}

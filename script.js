import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- 1. MATEMÁTICA L*a*b* a RGB ---
function lab2rgb(L, a, b) {
    let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
    const inv_f = (t) => t > 0.20689655172 ? Math.pow(t, 3) : 0.12841854934 * (t - 0.13793103448);
    let X = 95.047 * inv_f(x) / 100, Y = 100.000 * inv_f(y) / 100, Z = 108.883 * inv_f(z) / 100;
    
    let r = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
    let g = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
    let b_rgb = X * 0.0557 + Y * -0.2040 + Z * 1.0570;
    
    const gamma = (c) => {
        c = Math.max(0, Math.min(1, c));
        return c > 0.0031308 ? 1.055 * Math.pow(c, 1/2.4) - 0.055 : 12.92 * c;
    };
    return [Math.round(gamma(r)*255), Math.round(gamma(g)*255), Math.round(gamma(b_rgb)*255)];
}

function rgb2hex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// --- 2. ESTADO GLOBAL ---
const state = {
    c1: { L: 50.0, a: 0.0, b: 0.0 },
    c2: { L: 75.0, a: 60.0, b: -60.0 }
};

// --- 3. CONFIGURACIÓN THREE.JS ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f4f4); // Fondo gris claro

// En Three.js, Y es arriba. Mapearemos: X = a*, Y = L*, Z = b*
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(250, 150, 250);

// preserveDrawingBuffer necesario para exportar imagen
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 50, 0); // Mirar al centro de la caja (L=50)

// --- 4. DIBUJAR ENTORNO ESTÁTICO 3D ---
const materialEjes = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

// Caja y cuadrícula a la altura de L=50 (Y=50)
const gridHelper = new THREE.GridHelper(256, 4, 0x999999, 0xdddddd);
gridHelper.position.y = 50;
scene.add(gridHelper);

// Eje L (Blanco/Negro)
const pointsL = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 100, 0)];
const lineL = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsL), materialEjes);
scene.add(lineL);

// Función auxiliar para texto 3D (Sprites 2D)
function createTextSprite(message, colorStr) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 128;
    context.font = "Bold 35px Arial";
    context.fillStyle = colorStr;
    context.textAlign = "center";
    context.fillText(message, 128, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(40, 20, 1);
    return sprite;
}

// Etiquetas y ejes fijos (CORREGIDO)
const etiquetas = [
    { texto: "L = 100", color: "#000", pos: [0, 108, 0] },
    { texto: "L = 0", color: "#000", pos: [0, -8, 0] },
    { texto: "+a (Red)", color: "red", pos: [140, 50, 0] },
    { texto: "-a (Green)", color: "green", pos: [-140, 50, 0] },
    { texto: "+b (Yellow)", color: "#D4AF37", pos: [0, 50, 140] },
    { texto: "-b (Blue)", color: "blue", pos: [0, 50, -140] }
];

etiquetas.forEach(etiq => {
    const sprite = createTextSprite(etiq.texto, etiq.color);
    sprite.position.set(etiq.pos[0], etiq.pos[1], etiq.pos[2]); // Primero lo posicionamos
    scene.add(sprite); // Luego lo añadimos a la escena
});

// --- 5. VECTORES DINÁMICOS ---
let dynamicGroup = new THREE.Group();
scene.add(dynamicGroup);

function update3D() {
    dynamicGroup.clear(); // Limpia los vectores anteriores rapidísimo
    
    [state.c1, state.c2].forEach((c, index) => {
        const rgb = lab2rgb(c.L, c.a, c.b);
        const hex = rgb2hex(rgb[0], rgb[1], rgb[2]);
        const mat = new THREE.LineBasicMaterial({ color: hex, linewidth: 4 });
        
        // Línea desde (0,50,0) hasta (a, L, b)
        const points = [new THREE.Vector3(0, 50, 0), new THREE.Vector3(c.a, c.L, c.b)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        dynamicGroup.add(new THREE.Line(geo, mat));
        
        // Esfera en la punta
        const sphereGeo = new THREE.SphereGeometry(4, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: hex });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.set(c.a, c.L, c.b);
        dynamicGroup.add(sphere);

        // Etiqueta "1" o "2"
        const label = createTextSprite(index === 0 ? "1" : "2", hex);
        label.position.set(c.a + 10, c.L + 10, c.b);
        dynamicGroup.add(label);
    });
}

// --- 6. ACTUALIZAR INTERFAZ Y DEGRADADOS CSS ---
function getGradientStr(varName) {
    // Generamos 5 puntos para crear un gradiente perfecto en CSS
    let stops = [];
    const min = varName === 'L' ? 0 : -128;
    const max = varName === 'L' ? 100 : 128;
    for(let i=0; i<=4; i++) {
        let val = min + (max - min) * (i/4);
        let L = varName === 'L' ? val : state.c2.L;
        let a = varName === 'a' ? val : state.c2.a;
        let b = varName === 'b' ? val : state.c2.b;
        let rgb = lab2rgb(L, a, b);
        stops.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
}

function updateUI() {
    // Sincronizar Cajas y Sliders
    document.getElementById('c1-L').value = state.c1.L;
    document.getElementById('c1-a').value = state.c1.a;
    document.getElementById('c1-b').value = state.c1.b;
    
    document.getElementById('sl-L').value = state.c2.L; document.getElementById('c2-L').value = state.c2.L;
    document.getElementById('sl-a').value = state.c2.a; document.getElementById('c2-a').value = state.c2.a;
    document.getElementById('sl-b').value = state.c2.b; document.getElementById('c2-b').value = state.c2.b;

    // Actualizar Muestras y HEX
    const rgb1 = lab2rgb(state.c1.L, state.c1.a, state.c1.b);
    const hex1 = rgb2hex(rgb1[0], rgb1[1], rgb1[2]);
    document.getElementById('swatch1').style.backgroundColor = hex1;
    document.getElementById('hex1').value = hex1;

    const rgb2 = lab2rgb(state.c2.L, state.c2.a, state.c2.b);
    const hex2 = rgb2hex(rgb2[0], rgb2[1], rgb2[2]);
    document.getElementById('swatch2').style.backgroundColor = hex2;
    document.getElementById('hex2').value = hex2;

    // Actualizar Fondos Degradados de los sliders
    document.getElementById('sl-L').style.background = getGradientStr('L');
    document.getElementById('sl-a').style.background = getGradientStr('a');
    document.getElementById('sl-b').style.background = getGradientStr('b');

    // Deltas
    let dL = state.c2.L - state.c1.L, da = state.c2.a - state.c1.a, db = state.c2.b - state.c1.b;
    let dE = Math.sqrt(dL*dL + da*da + db*db);
    document.getElementById('txt-deltas').innerHTML = `ΔL*: ${dL.toFixed(1)} &nbsp;|&nbsp; Δa*: ${da.toFixed(1)} &nbsp;|&nbsp; Δb*: ${db.toFixed(1)} <br> <span style="font-size:16px; color:#d9534f">ΔE* = ${dE.toFixed(1)}</span>`;

    update3D();
}

// --- 7. LISTENERS DE EVENTOS ---
function attachListeners() {
    const bindInput = (id, obj, key) => {
        document.getElementById(id).addEventListener('input', (e) => {
            state[obj][key] = parseFloat(e.target.value) || 0;
            updateUI();
        });
    };
    bindInput('c1-L', 'c1', 'L'); bindInput('c1-a', 'c1', 'a'); bindInput('c1-b', 'c1', 'b');
    bindInput('sl-L', 'c2', 'L'); bindInput('c2-L', 'c2', 'L');
    bindInput('sl-a', 'c2', 'a'); bindInput('c2-a', 'c2', 'a');
    bindInput('sl-b', 'c2', 'b'); bindInput('c2-b', 'c2', 'b');
}

// Bucle de animación nativo de WebGL
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- 8. BOTONES DE EXPORTACIÓN (Nuevas Funciones) ---
const exportCanvas = document.createElement('canvas'); // Canvas oculto para generar imágenes
const exportCtx = exportCanvas.getContext('2d');

function downloadCanvasImage(filename, size) {
    exportCanvas.width = size;
    exportCanvas.height = size;
    // La función que llame a esta se encargará de dibujar en exportCtx
    const link = document.createElement('a');
    link.download = `${filename}_${new Date().getTime()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

function saveCircularColorImage(rgb, filename) {
    const size = 512;
    exportCtx.clearRect(0, 0, size, size);
    exportCtx.beginPath();
    exportCtx.arc(size/2, size/2, size/2 - 10, 0, 2 * Math.PI);
    exportCtx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    exportCtx.fill();
    exportCtx.strokeStyle = "#000";
    exportCtx.lineWidth = 10;
    exportCtx.stroke();
    downloadCanvasImage(filename, size);
}

document.getElementById('btn-save-3d').addEventListener('click', () => {
    renderer.render(scene, camera); // Renderizar frame actual
    const link = document.createElement('a');
    link.download = `Colorimetro_3D_${new Date().getTime()}.png`;
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
});

document.getElementById('btn-export-txt').addEventListener('click', () => {
    let dL = state.c2.L - state.c1.L, da = state.c2.a - state.c1.a, db = state.c2.b - state.c1.b;
    let dE = Math.sqrt(dL*dL + da*da + db*db);
    const texto = `=== REPORTE L*a*b* ===\nColor 1 (Ref): L=${state.c1.L}, a=${state.c1.a}, b=${state.c1.b} | HEX: ${document.getElementById('hex1').value}\nColor 2 (Muestra): L=${state.c2.L}, a=${state.c2.a}, b=${state.c2.b} | HEX: ${document.getElementById('hex2').value}\n\nDELTAS:\nΔL*: ${dL.toFixed(2)}\nΔa*: ${da.toFixed(2)}\nΔb*: ${db.toFixed(2)}\nΔE*: ${dE.toFixed(2)}`;
    
    const blob = new Blob([texto], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = `Reporte_${new Date().getTime()}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
});

document.getElementById('btn-save-c1-circle').addEventListener('click', () => {
    const rgb = lab2rgb(state.c1.L, state.c1.a, state.c1.b);
    saveCircularColorImage(rgb, "Color1_Circular");
});

document.getElementById('btn-save-c2-circle').addEventListener('click', () => {
    const rgb = lab2rgb(state.c2.L, state.c2.a, state.c2.b);
    saveCircularColorImage(rgb, "Color2_Circular");
});

document.getElementById('btn-save-together-square').addEventListener('click', () => {
    const size = 512;
    exportCanvas.width = size;
    exportCanvas.height = size;
    exportCtx.clearRect(0, 0, size, size);
    
    // Mitad izquierda: Color 1
    const rgb1 = lab2rgb(state.c1.L, state.c1.a, state.c1.b);
    exportCtx.fillStyle = `rgb(${rgb1[0]}, ${rgb1[1]}, ${rgb1[2]})`;
    exportCtx.fillRect(0, 0, size/2, size);
    
    // Mitad derecha: Color 2
    const rgb2 = lab2rgb(state.c2.L, state.c2.a, state.c2.b);
    exportCtx.fillStyle = `rgb(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]})`;
    exportCtx.fillRect(size/2, 0, size/2, size);
    
    // Borde negro
    exportCtx.strokeStyle = "#000";
    exportCtx.lineWidth = 10;
    exportCtx.strokeRect(0, 0, size, size);
    
    const link = document.createElement('a');
    link.download = `ColoresTogether_Cuadrado_${new Date().getTime()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});

// Redimensionar ventana
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// Inicializar
updateUI();
animate();
attachListeners();

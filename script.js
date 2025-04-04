// Ensure strict mode
"use strict";

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startButton = document.getElementById('startButton');
const startButtonContainer = document.getElementById('startButtonContainer');

// Three.js variables
let scene, camera, renderer, cube;
let ambientLight, directionalLight;

// Sensor data variables
let currentOrientation = { alpha: 0, beta: 90, gamma: 0 }; // Initial default beta to avoid looking straight down

// Touch interaction variables
let isDragging = false;
let previousTouchPosition = { x: 0, y: 0 };
const DRAG_SENSITIVITY = 0.005;
const CUBE_INITIAL_Y = -0.5;

// Temporary vectors/quaternions for calculations
const cameraRight = new THREE.Vector3();
const cameraForwardProjected = new THREE.Vector3();
const moveVector = new THREE.Vector3();
const tempEuler = new THREE.Euler(); // Reusable Euler object
const tempQuaternion = new THREE.Quaternion(); // Reusable Quaternion

// --- NEW: Orientation Correction Helpers ---
// Correction for device coordinate system to Three.js world system
const deviceToWorldQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), // Rotate around X-axis
    -Math.PI / 2 // by -90 degrees
);
// Optional: Screen orientation adjustment (start with portrait)
const screenAdjustmentQuaternion = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1); // Static Z axis for screen adjustment


// --- Initialization ---
function init() {
    // ... (init checks remain the same) ...
    startButton.addEventListener('click', handleStartClick);
}

// --- Permission Handling (handleStartClick, startExperience) ---
// ... (remain the same as the previous version) ...
async function handleStartClick() { // Simplified for brevity
    console.log("Start button clicked...");
    startButton.disabled = true;
    startButton.textContent = 'Requesting Permissions...';
    try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                 alert("Orientation permission denied.");
                 console.warn("Proceeding without orientation permission.");
                // Allow proceeding but orientation won't work
            } else {
                console.log("Orientation permission granted.");
            }
        }
        console.log("Permissions check complete. Proceeding...");
        await startExperience();
    } catch (err) {
        console.error("Error during permission request phase:", err);
        alert(`Error requesting permissions: ${err.name}`);
        startButton.disabled = false;
        startButton.textContent = 'Start AR Experience';
    }
}

async function startExperience() { // Simplified for brevity
     console.log("Starting camera and Three.js setup...");
    startButtonContainer.classList.add('hidden');
    try {
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }});
        video.srcObject = stream;
        await video.play();
        console.log("Camera access granted.");

        setupThreeJS();
        setupOrientationSensor(); // Includes adding the orientationchange listener now
        setupTouchControls();
        animate();
        console.log("AR Experience Started");
    } catch (err) {
        console.error("Error during camera/setup phase:", err);
        alert(`Error starting AR experience: ${err.name}`);
        startButtonContainer.classList.remove('hidden');
        startButton.disabled = false;
        startButton.textContent = 'Start AR Experience';
    }
}


// --- Setup Functions (setupThreeJS, setupTouchControls) ---
// ... (remain largely the same) ...
function setupThreeJS() {
    scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 0.5, 3); // Start slightly above and back

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5, metalness: 0.2 });
    cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, CUBE_INITIAL_Y, 0);
    scene.add(cube);
    camera.lookAt(cube.position); // Look at the cube initially

    ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(1, 2, 1).normalize();
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

function setupOrientationSensor() {
    if ('DeviceOrientationEvent' in window) {
        console.log("Adding deviceorientation listener...");
        window.addEventListener('deviceorientation', handleOrientation);
        // --- NEW: Listen for screen orientation changes ---
        if (screen.orientation) { // Check if the API exists
             console.log("Adding screen orientationchange listener...");
             screen.orientation.addEventListener("change", handleScreenOrientationChange);
             handleScreenOrientationChange(); // Call once initially
        } else {
             // Fallback for older API (less reliable)
             console.log("Adding window orientationchange listener (fallback)...");
             window.addEventListener('orientationchange', handleScreenOrientationChange);
             handleScreenOrientationChange(); // Call once initially
        }

    } else {
        console.warn("DeviceOrientationEvent API not found.");
    }
}

function setupTouchControls() {
    // ... (remains the same) ...
    console.log("Setting up touch controls...");
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
}

// --- Event Handlers ---

function handleOrientation(event) {
    currentOrientation.alpha = event.alpha || 0;
    currentOrientation.beta = event.beta || 0;
    currentOrientation.gamma = event.gamma || 0;
}

// --- NEW: Handle screen orientation changes ---
function handleScreenOrientationChange() {
    // Use modern API if available, fallback to deprecated window.orientation
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    console.log("Screen orientation changed:", angle);
    // Adjust around Z axis by the negative of the screen angle
    screenAdjustmentQuaternion.setFromAxisAngle(Z_AXIS, -THREE.MathUtils.degToRad(angle));
}


function onTouchStart(event) {
    // ... (remains the same) ...
    event.preventDefault();
    if (event.touches.length === 1) {
        isDragging = true;
        previousTouchPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
}

function onTouchMove(event) {
    // *** Crucially, this function now relies on the CORRECT camera orientation ***
    // *** The logic inside it doesn't need to change, but its inputs (camera vectors) will be correct ***
    event.preventDefault();
    if (!isDragging || event.touches.length !== 1 || !cube) return;

    const currentTouchPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    const deltaX = currentTouchPosition.x - previousTouchPosition.x;
    const deltaY = currentTouchPosition.y - previousTouchPosition.y;

    // Get Camera's Right Vector (relative to current orientation)
    camera.getWorldDirection(moveVector); // Use moveVector temporarily just to update matrixWorld
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);

    // Get Camera's Forward Vector Projected onto the horizontal plane (XZ)
    camera.getWorldDirection(cameraForwardProjected);
    cameraForwardProjected.y = 0;
    cameraForwardProjected.normalize();
    if (isNaN(cameraForwardProjected.x)) { // Handle looking straight up/down
        cameraForwardProjected.set(0, 0, (camera.position.y > cube.position.y) ? -1 : 1);
    }

    // Calculate Movement Vector based on projected axes
    moveVector.set(0, 0, 0); // Reset move vector
    moveVector.addScaledVector(cameraRight, deltaX * DRAG_SENSITIVITY);
    moveVector.addScaledVector(cameraForwardProjected, -deltaY * DRAG_SENSITIVITY);

    // Apply Movement, Constrained to Plane
    cube.position.x += moveVector.x;
    cube.position.z += moveVector.z;
    // cube.position.y remains fixed

    previousTouchPosition = currentTouchPosition;
}

function onTouchEnd(event) {
    // ... (remains the same) ...
    if (isDragging) isDragging = false;
}

function onWindowResize() {
    // ... (remains the same) ...
     if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Also update screen orientation on resize potentially
        handleScreenOrientationChange();
    }
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);
    if (!scene || !camera || !renderer) return;

    // Update Camera Orientation using the corrected method
    updateCameraOrientation(); // <<<< CALLS THE REVISED FUNCTION

    // Render the scene
    renderer.render(scene, camera);
}

// --- REVISED: Update Camera Orientation ---
function updateCameraOrientation() {
    const alphaRad = THREE.MathUtils.degToRad(currentOrientation.alpha); // Compass
    const betaRad = THREE.MathUtils.degToRad(currentOrientation.beta);   // Front/back tilt
    const gammaRad = THREE.MathUtils.degToRad(currentOrientation.gamma); // Left/right tilt

    // 1. Create Euler angles from device orientation using 'YXZ' order
    // This order seems most common for mapping device->Euler before corrections
    tempEuler.set(betaRad, alphaRad, -gammaRad, 'YXZ');

    // 2. Convert Euler to Quaternion
    tempQuaternion.setFromEuler(tempEuler);

    // 3. Apply World Coordinate System Correction
    // Multiply by the quaternion that rotates device axes to world axes (-90 deg on X)
    tempQuaternion.multiply(deviceToWorldQuaternion);

    // 4. Apply Screen Orientation Correction
    // Multiply by the quaternion that adjusts for screen rotation
    tempQuaternion.multiply(screenAdjustmentQuaternion);

    // 5. Apply the final corrected quaternion to the camera
    camera.quaternion.copy(tempQuaternion);
}

// --- Start everything ---
init();
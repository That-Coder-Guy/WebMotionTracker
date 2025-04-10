const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

let vector = [0, 0];
let camera;
let model;

function start()
{
	scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1);

	// Camera
	camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 1, -10), scene);
	camera.attachControl(canvas, true);

	// Light
	const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
	light.intensity = 0.9;

	// Create 64 small cubes
	let cubes = [];
	const size = 1;
	const spacing = 1.1;

	for (let x = 0; x < 4; x++) {
		for (let y = 0; y < 4; y++) {
			for (let z = 0; z < 4; z++) {
				const box = BABYLON.MeshBuilder.CreateBox("box", { size }, scene);
				box.position.set(
					(x - 1.5) * spacing,
					(y - 1.5) * spacing,
					(z - 1.5) * spacing
				);
				cubes.push(box);
			}
		}
	}

	// Merge cubes into a single mesh
	model = BABYLON.Mesh.MergeMeshes(cubes, true, true, undefined, false, true);
	model.name = "mergedCube";

	// Material
	const mat = new BABYLON.StandardMaterial("mat", scene);
	mat.diffuseColor = new BABYLON.Color3(0.4, 0.6, 1.0);
	model.material = mat;
}

function update()
{
	camera.position.x -= vector[0] * 0.5;
	camera.position.z += vector[1] * 0.5;
}


// Rotation using arrow keys
scene.onKeyboardObservable.add((kbInfo) => {
	switch (kbInfo.type)
	{
		case BABYLON.KeyboardEventTypes.KEYDOWN:
			switch (kbInfo.event.key)
			{
				case "w":
					vector[1] = 1;
					break;
				case "s":
					vector[1] = -1;
					break;
				case "a":
					vector[0] = 1;
					break;
				case "d":
					vector[0] = -1;
					break;
			}
			break;
		case BABYLON.KeyboardEventTypes.KEYUP:
			switch (kbInfo.event.key)
				{
					case "w":
					case "s":
						vector[1] = 0;
						break;
					case "a":
					case "d":
						vector[0] = 0;
						break;
				}
			break;
	}
});

// FPS Counter
const fpsCounter = document.getElementById("fpsCounter");
// Setup the game loop
start();
engine.runRenderLoop(() => {
	update()
	scene.render();
	fpsCounter.textContent = `FPS: ${Math.round(engine.getFps())}`;
});

window.addEventListener("resize", () => engine.resize());

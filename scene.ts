/*
 *  Things that handle all the 3D stuff
 */

import { EffectComposer, RenderPass } from "postprocessing";
import * as THREE from "three";
import { Light } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { BuildingTileType, RoadTileType } from "./algo";
import {
    ENVIRONMENT_ANIMATED_ASSET,
    ENVIRONMENT_ASSET,
    ENVIRONMENT_OBJECTS_ASSET,
    FLOOR_HEIGHT,
    GRASS_ASSET,
    ROAD_TYPES,
    TREES_SMALL,
} from "./constants";

// Global GLTF loader
const loader = new GLTFLoader();

export function createScene() {
    // Create scene
    const scene = new THREE.Scene();
    const camera = createCamera();
    const renderer = createRenderer(scene, camera);

    setupLighting(scene);

    const updateMixer = setupEnvironment(scene);

    const controls = createControls(camera, renderer);

    const composer = setupPostProcessing(scene, camera, renderer);

    const clock = new THREE.Clock();

    // Animation loop
    function animate() {
        const delta = clock.getDelta();

        requestAnimationFrame(animate);
        controls.update();
        updateMixer(delta);
        composer.render();
    }
    animate();

    // Resize renderer when window size changes
    window.onresize = () => {
        resizeRenderer(renderer);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    return { scene, controls };
}

export function clearScene(scene: THREE.Scene) {
    const toDelete = ["Building", "Road", "Grass", "Tree"];
    for (let i = scene.children.length - 1; i >= 0; i--) {
        if (toDelete.includes(scene.children[i].name))
            scene.remove(scene.children[i]);
    }
}

export function changeShadowPreset(
    scene: THREE.Scene,
    preset: string | number,
) {
    for (const child of <Light[]>scene.children) {
        if (child.type === "DirectionalLight") {
            if (typeof preset === "string") preset = parseInt(preset);
            if (preset === 1) {
                child.shadow.mapSize.x = 768;
                child.shadow.mapSize.y = 768;
                child.shadow.map.dispose();
                child.shadow.map = <any>null;
            } else if (preset === 2) {
                child.shadow.mapSize.x = 2048;
                child.shadow.mapSize.y = 2048;
                child.shadow.map.dispose();
                child.shadow.map = <any>null;
            }
        }
    }
}

// Set shadows on given object to given settings
function setShadow(obj: THREE.Object3D, cast = false, receive = false) {
    obj.castShadow = cast;
    obj.receiveShadow = receive;
    if (obj?.children != null) {
        for (const child of obj.children) {
            setShadow(child, cast, receive);
        }
    }
}

export function renderBuilding(
    x: number,
    y: number,
    z: number,
    building: BuildingTileType,
    scene: THREE.Scene,
) {
    const height = Math.min(building.value, 35); // Cap height
    for (let i = 0; i < height; i++) {
        let assetToLoad = "";
        if (i === 0)
            assetToLoad = building.building.groundUrl; // Load ground tile
        else if (i === height - 1)
            assetToLoad = <string>building.building.roofUrl; // Load roof tile
        else assetToLoad = <string>building.building.floorUrl; // Load floor tile
        if (assetToLoad == null || assetToLoad === "") return;

        loader.load(
            `./assets/${assetToLoad}`,
            function (gltf) {
                const isLShaped = building.type === 2;
                let extraShiftZ = 0;
                let extraShiftX = 0;
                if (isLShaped && building.dir === 1) {
                    extraShiftZ = 2;
                    extraShiftX = 2;
                }
                let extraAngle = 0;

                setShadow(gltf.scene, true, false);

                gltf.scene.name = "Building";
                if (building.mirror) {
                    gltf.scene.scale.z *= -1; // mirror the object
                    extraAngle = 270; // add extra angle to compensate shift from mirroring
                }

                gltf.scene.position.y = y + i * FLOOR_HEIGHT * 2;
                gltf.scene.position.x = x + extraShiftX;
                gltf.scene.position.z = z + extraShiftZ;

                gltf.scene.rotation.y = THREE.MathUtils.degToRad(
                    -90 * (building.dir + (isLShaped ? 2 : 0)) - extraAngle,
                );

                scene.add(gltf.scene);
            },
            undefined,
            function (error) {
                console.error(error);
            },
        );
    }
}

export function renderRoad(
    x: number,
    y: number,
    z: number,
    road: RoadTileType,
    scene: THREE.Scene,
) {
    let assetToLoad = "";
    if (road.type === 0) assetToLoad = ROAD_TYPES[0]; // 2 way road
    else if (road.type === 1) assetToLoad = ROAD_TYPES[1]; // 3 way road
    else if (road.type === 2) assetToLoad = ROAD_TYPES[2]; // 4 way road
    else if (road.type === 3) assetToLoad = ROAD_TYPES[3]; // 2 way turn
    if (assetToLoad == null || assetToLoad === "") return;

    loader.load(
        `./assets/${assetToLoad}`,
        function (gltf) {
            gltf.scene.position.y = y;
            gltf.scene.position.x = x;
            gltf.scene.position.z = z;
            gltf.scene.rotation.y = THREE.MathUtils.degToRad(-90 * road.dir);

            setShadow(gltf.scene, false, true);

            gltf.scene.name = "Road";
            scene.add(gltf.scene);
        },
        undefined,
        function (error) {
            console.error(error);
        },
    );
}

export function renderGrass(
    x: number,
    y: number,
    z: number,
    scene: THREE.Scene,
) {
    const assetToLoad = GRASS_ASSET;

    loader.load(
        `./assets/${assetToLoad}`,
        function (gltf) {
            gltf.scene.position.y = y;
            gltf.scene.position.x = x;
            gltf.scene.position.z = z;

            setShadow(gltf.scene, false, true);

            gltf.scene.name = "Grass";
            scene.add(gltf.scene);
        },
        undefined,
        function (error) {
            console.error(error);
        },
    );

    // Create a tree somewhere on the tile
    for (const i of [-0.7, 0.7]) {
        loader.load(
            `./assets/${
                TREES_SMALL[Math.floor(TREES_SMALL.length * Math.random())]
            }`,
            function (gltf) {
                gltf.scene.position.x = x + Math.random() * i;
                gltf.scene.position.y = y;
                gltf.scene.position.z = z + Math.random() * i;

                setShadow(gltf.scene, true, false);

                gltf.scene.name = "Tree";
                scene.add(gltf.scene);
            },
        );
    }
}

// Convert given scene into STL blob
export function convertSceneToStlBlob(scene: THREE.Scene) {
    const exporter = new STLExporter();
    const str = exporter.parse(scene);
    return new Blob([str], { type: "text/plain" });
}

// Create and cofigure camera and return it
function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        400,
    );
    camera.position.set(0, 30, 51);

    return camera;
}

// Create and configure renderer and return it
function createRenderer(scene: THREE.Scene, camera: THREE.Camera) {
    const renderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: true,
        depth: true,
        canvas: <HTMLCanvasElement>document.querySelector("#bg"),
    });

    resizeRenderer(renderer);

    renderer.render(scene, camera);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    return renderer;
}

// Set's the renderers size to current window size
function resizeRenderer(renderer: THREE.WebGLRenderer) {
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create and configure controls and return it
function createControls(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = -1;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = 30;
    controls.maxDistance = 150;

    return controls;
}

// Configure postprocessing and return composer
function setupPostProcessing(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.Renderer,
) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    return composer;
}

// Create and configure lighting in the scene
function setupLighting(scene: THREE.Scene) {
    // Ambient lighting
    const ambientLight = new THREE.AmbientLight(0x9ad0ec, 0.7);
    // const ambientLight = new THREE.AmbientLight(0x9AD0EC, 1);
    scene.add(ambientLight);

    // Directional lighting and shadows
    const directionLight = new THREE.DirectionalLight(0xe9b37c);
    directionLight.position.set(-50, 50, -20);
    directionLight.castShadow = true;
    directionLight.shadow.mapSize.x = 768;
    directionLight.shadow.mapSize.y = 768;
    directionLight.shadow.camera.near = 15;
    directionLight.shadow.camera.far = 150.0;
    directionLight.shadow.camera.right = 75;
    directionLight.shadow.camera.left = -75;
    directionLight.shadow.camera.top = 75;
    directionLight.shadow.camera.bottom = -75;
    scene.add(directionLight);
}

// Create and setup anything environment-related
function setupEnvironment(scene: THREE.Scene) {
    const sceneBackground = new THREE.Color(0x9ad0ec);
    scene.background = sceneBackground;

    const position = new THREE.Vector3(0, -4, 0);

    // Render environment (ground)
    loader.load(`./assets/${ENVIRONMENT_ASSET}`, function (gltf) {
        const env = gltf.scene;
        env.position.set(position.x, position.y, position.z);
        setShadow(gltf.scene, false, true);
        scene.add(env);
    });

    // Render environment (objects and other stuff)
    loader.load(`./assets/${ENVIRONMENT_OBJECTS_ASSET}`, function (gltf) {
        const envObjects = gltf.scene;
        envObjects.position.set(position.x, position.y, position.z);
        setShadow(gltf.scene, true, false);
        scene.add(envObjects);
    });

    // Render and animate animated environment
    let mixer: THREE.AnimationMixer;
    const updateMixer = (delta: number) => {
        if (mixer) mixer.update(delta);
    };

    loader.load(`./assets/${ENVIRONMENT_ANIMATED_ASSET}`, function (gltf) {
        const envAnimated = gltf.scene;
        envAnimated.position.set(position.x, position.y, position.z);
        setShadow(gltf.scene, true, false);

        // Setup animation mixer and play all animations
        mixer = new THREE.AnimationMixer(envAnimated);
        const clips = gltf.animations;

        clips.forEach(function (clip) {
            mixer.clipAction(clip).play();
        });

        scene.add(envAnimated);
    });

    return updateMixer;
}

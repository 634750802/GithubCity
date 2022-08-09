import { saveAs } from "file-saver";

import { findTiles, getTileTypes, initializeTiles } from "./algo";
import { fetchContributions, getConvertedContributions } from "./api";
import { INIT_CONTRIBUTIONS } from "./constants";
import {
    changeShadowPreset,
    clearScene,
    convertSceneToStlBlob,
    createScene,
    renderBuilding,
    renderGrass,
    renderRoad,
} from "./scene";

// Get HTML elements
const autoRotateButton = <HTMLButtonElement>(
    document.getElementById("autorotate")
);
const downloadButton = <HTMLButtonElement>document.getElementById("download");
const yearSelect = <HTMLSelectElement>document.getElementById("yearSelect");
const usernameInput = <HTMLInputElement>(
    document.getElementById("usernameInput")
);
const infoForm = <HTMLFormElement>document.getElementById("infoForm");
const selectionScreen = <HTMLSelectElement>(
    document.getElementById("selectionScreen")
);
const titleLink = <HTMLAnchorElement>document.getElementById("title");
const displayInfo = <HTMLDivElement>document.getElementById("displayInfo");
const errorMessage = <HTMLParagraphElement>(
    document.getElementById("errorMessage")
);
const shadowPreset = <HTMLInputElement>document.getElementById("shadowPreset");

// Populate year select with years down to 2008
const currentYear = new Date().getFullYear();
for (let y = currentYear; y >= 2008; y--) {
    const option = document.createElement("option");
    option.value = String(y);
    option.innerHTML = String(y);
    yearSelect.appendChild(option);
}

// Create 3D environment
const { scene, controls } = createScene();
const renderShiftX = -26;
const renderShiftY = -4;
const renderShiftZ = 0.38;

let enteredInfo = false;

const urlParams = new URLSearchParams(window.location.search);
const name = urlParams.get("name");
const year = urlParams.get("year");
if (name && year) {
    // Generate city with url params
    enteredInfo = true;
    generateCityFromParams(name, year);
} else {
    // Placeholder city
    generateCity(INIT_CONTRIBUTIONS);
}

/* - - Input events - - */
// Set autorotations
autoRotateButton.onclick = (e) => {
    e.preventDefault();
    controls.autoRotate = !controls.autoRotate;
    if (controls.autoRotate) autoRotateButton.classList.remove("inactive");
    else autoRotateButton.classList.add("inactive");
};

// Submit form, get data and generate city
infoForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    const year = yearSelect.value;
    enteredInfo = true;
    const tempArray = window.location.href.split("?");
    const baseURL = tempArray[0];
    const newUrl = `${baseURL}?name=${name}&year=${year}`;
    window.history.replaceState("", "", newUrl);
    await generateCityFromParams(name, year);
};

// Open UI back, start autorotation
titleLink.onclick = (e) => {
    e.preventDefault();
    if (!selectionScreen.classList.contains("hidden") && enteredInfo) {
        selectionScreen.classList.add("hidden");
    } else {
        selectionScreen.classList.remove("hidden");
        controls.autoRotate = true;
        infoForm.style.display = "";
        errorMessage.style.display = "none";
    }

    if (controls.autoRotate) autoRotateButton.classList.remove("inactive");
    else autoRotateButton.classList.add("inactive");
};

shadowPreset.onchange = () => {
    changeShadowPreset(scene, shadowPreset.value);
};

async function generateCityFromParams(name: string, year: string) {
    // Get data from API
    const apiContribs = await fetchContributions(name, year);
    if (apiContribs == null) {
        errorMessage.style.display = "block";
        return;
    }

    // Convert data to 2D array
    const contribs = getConvertedContributions(apiContribs);

    selectionScreen.classList.add("hidden");
    infoForm.style.display = "none";
    displayInfo.innerHTML = `<span>${name}</span> <span>${year}</span>`;

    // Render data
    generateCity(contribs);

    downloadButton.onclick = (e) => {
        e.preventDefault();
        const blob = convertSceneToStlBlob(scene);
        saveAs(blob, `${name}-${year}-city.stl`);
    };
}

// Get the 2D array containing contributions and make stuff happen
function generateCity(contribs: number[][]) {
    // Reset city
    clearScene(scene);

    // Initialize city layout for initial view
    initializeTiles(contribs);
    findTiles();
    const tileTypes = getTileTypes();

    // Render city
    for (let i = 0; i < tileTypes.length; i++) {
        for (let j = 0; j < tileTypes[0].length; j++) {
            const tileType = tileTypes[i][j];
            const x = 2 * (j + renderShiftX) * 1.1;
            const z = 2 * (i + renderShiftY) * 1.1;
            if (tileType.tile === 0) {
                // Render grass tiles
                renderGrass(x, 0, z, scene);
            } else if (tileType.tile === 1) {
                // Render road tiles
                renderRoad(x, -0.015, z, tileType, scene);
            } else if (tileType.tile === 2) {
                // Render building tiles
                renderBuilding(x, 2 * renderShiftZ, z, tileType, scene);
            }
        }
    }
}

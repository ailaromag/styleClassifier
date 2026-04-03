const MODEL_URL = "https://teachablemachine.withgoogle.com/models/bMXg8u3wX/";
const THRESHOLD = 0.3;//0.7;
const galleryQueue = [];
const MAX_GALLERY = 16;
const resultPage = new ResultPage(CONFIG);

const state = {
    model: null,
    maxPredictions: 0,
    webcam: null,
    isWebcamActive: false,
    currentStyle: null,
    isDetecting: false,
    lastFaceBox: null,
    kidMode: false,
    smoothBox: null,
    popupEnabled: false
};

const elements = {
    webcamBtn: document.getElementById("webcam-btn"),
    captureBtn: document.getElementById("capture-btn"),
    imageInput: document.getElementById("image-input"),
    uploadedImage: document.getElementById("uploaded-image"),
    predictedClass: document.getElementById("predicted-class"),
    confidence: document.getElementById("confidence"),
    display: document.getElementById("display"),
    overlay: document.getElementById("overlay"),
    resetBtn: document.getElementById("reset-btn"),
    popupSwitch: document.getElementById("popup-switch"),
    modeSwitch: document.getElementById("mode-switch")

};


/**
 * Carrega el model de Teachable Machine des de la URL 
 */
async function init() {
    // Inicialitzar detector facial MediaPipe
    state.faceDetector = new FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    state.faceDetector.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
    });
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";
    state.model = await tmImage.load(modelURL, metadataURL);
    state.maxPredictions = state.model.getTotalClasses();
}

/**
 * Atura la webcam i neteja els elements associats
 */
function stopWebcam() {
    if (!state.webcam) return;
    state.webcam.stop();
    state.isWebcamActive = false;

    document.getElementById("webcam-canvas")?.remove();
    elements.captureBtn.style.display = "none";
    elements.webcamBtn.textContent = "Activar Webcam";

    resetValues();
}

/**
 * Inicialitza i activa la webcam, afegint el canvas al DOM
 */
async function startWebcam() {
    state.webcam = new tmImage.Webcam(400, 400, true);
    await state.webcam.setup();
    await state.webcam.play();

    state.webcam.canvas.id = "webcam-canvas";
    elements.display.appendChild(state.webcam.canvas);
    elements.uploadedImage.style.display = "none";
    elements.overlay.style.display = "none";

    elements.captureBtn.style.display = "block";
    state.isWebcamActive = true;
    elements.webcamBtn.textContent = "Desactivar Webcam";

    requestAnimationFrame(updateWebcam);
}

/**
 * Actualitza el frame de la webcam. Ha de detectar la cara en cada frame
 */
async function updateWebcam() { // Ara és async perque utilitzam await per la detecció facial
    if (state.isWebcamActive && state.webcam) {
        state.webcam.update();

        // Si hi ha un estil classificat, detectar la cara en el canvas en viu
        if (state.currentStyle && !state.isDetecting) {
            state.isDetecting = true;
            try {
                const box = await detectFace(state.webcam.canvas);
                if (box) {
                    //  state.lastFaceBox = box;
                    state.lastFaceBox = smoothBox(box);
                    positionOverlay(box);
                } else {
                    elements.overlay.style.display = "none";
                }
            } catch (e) {
            }
            state.isDetecting = false;
        } else if (state.smoothBox && state.currentStyle) {
            positionOverlay(state.smoothBox);
        }

        requestAnimationFrame(updateWebcam);
    }
}

/**
 * Loop d'actualització que refresca el frame de la webcam
 */
function updateProbabilityBar(className, probability) {
    const id = className.toLowerCase();
    const progressBar = document.getElementById(`prob-${id}`);
    const valueSpan = document.getElementById(`val-${id}`);

    if (progressBar) progressBar.value = probability * 100;
    if (valueSpan) valueSpan.textContent = `${(probability * 100).toFixed(1)}%`;
}


/**
 * Executa la predicció sobre una imatge i mostra els resultats
 */
async function predict(imageElement) {
    if (!state.model) return;

    const predictions = await state.model.predict(imageElement);

    let best = { probability: 0, className: "" };

    predictions.forEach(prediction => {
        updateProbabilityBar(prediction.className, prediction.probability);

        if (prediction.probability > best.probability) {
            best = prediction;
        }
    });

    if (best.probability > THRESHOLD) {
        const names = state.kidMode ? CONFIG.names.kid : CONFIG.names.adult;
        elements.predictedClass.textContent = names[best.className];
        state.currentStyle = best.className;
        elements.confidence.textContent = `amb confiança del: ${(best.probability * 100).toFixed(1)}%`;
        elements.overlay.src = CONFIG.overlays[best.className];

        elements.resetBtn.style.display = "block";

    } else {
        elements.predictedClass.textContent = "Classe desconeguda";
        elements.confidence.textContent = "Cap predicció supera el llindar";
        state.currentStyle = null;
        elements.overlay.style.display = "none";
    }
}

/**
 * Mostra una imatge al contenidor principal
 */
function showImage(src) {
    elements.uploadedImage.src = src;
    elements.uploadedImage.style.display = "block";
}

elements.webcamBtn.addEventListener("click", () => {
    state.isWebcamActive ? stopWebcam() : startWebcam();
});


/**
 * Metode de suport: Detecta la cara i retorna el bounding box
 */
function detectFace(imageElement) {
    return new Promise((resolve) => {
        state.faceDetector.onResults((results) => {
            if (results.detections.length > 0) {
                resolve(results.detections[0].boundingBox);
            } else {
                resolve(null);
            }
        });
        state.faceDetector.send({ image: imageElement });
    });
}

/**
 * Posiciona el overlay en base del bounding box de la cara
 */
function positionOverlay(box) {
    if (!box || !state.currentStyle) return;

    const displayW = elements.display.clientWidth;
    const displayH = elements.display.clientHeight;

    // Coordenades de MediaPipe son de 0.0 a 1.0. Les mapejam a pixels
    const width = box.width * displayW;
    const height = box.height * displayH;
    const x = (box.xCenter - box.width / 2) * displayW;
    const y = (box.yCenter - box.height / 2) * displayH;

    elements.overlay.src = CONFIG.overlays[state.currentStyle];
    elements.overlay.style.display = "block";

    // Canviam el tamany relatiu a la cara, un poc mes ample
    elements.overlay.style.width = (width * 1.5) + "px";

    // LÒGICA DE POSICIONAMENT
    // Centram horitzontalment
    elements.overlay.style.left = (x - (width * 0.25)) + "px";

    // Ajust vertical per als diferents components
    let yOffset = 0;
    if (state.currentStyle === "OldMoney") {
        yOffset = height * 1.1;
    } else if (state.currentStyle === "Rockstar") {
        yOffset = 0.0; // height * 0.0;
    } else if (state.currentStyle === "Streetwear") {
        elements.overlay.style.left = (x - (width * 0.35)) + "px";
        yOffset = height * 1;
    } else if (state.currentStyle === "CottageCore") {
        elements.overlay.style.width = (width * 1.6) + "px";
        yOffset = height * 1.3;

    }

    elements.overlay.style.top = (y - yOffset) + "px";
}

function detectFaceWithTimeout(imageElement, ms = 2000) {
    return Promise.race([
        detectFace(imageElement),
        new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);
}

/**
 * Captura el frame actual de la webcam i executa la predicció
 * Lógica de detecció facial + posicionament del overlay de l'estil classificat
 */
elements.captureBtn.addEventListener("click", async () => {
    if (!state.webcam) return;

    document.getElementById("result-placeholder")?.remove();


    // Efecte flash
    const flash = document.getElementById("flash");
    flash.classList.remove("active");
    void flash.offsetWidth;
    flash.classList.add("active");


    // 1. Congelar: capturar el frame com imatge estàtica
    const imageDataURL = state.webcam.canvas.toDataURL("image/png");
    showImage(imageDataURL);
    elements.uploadedImage.classList.add("captured");
    state.webcam.pause();       //Pausam per un segon
    document.getElementById("webcam-canvas").style.display = "none";

    const loading = document.getElementById("loading");
    document.getElementById("result").classList.add("is-loading");
    loading.style.display = "block";
    resetValues();


    // 2. Classificar la imatge estática
    setTimeout(async () => {
        // 1. Detectar la cara PRIMER
        let faceBox = null;
        try {
            const tempCanvas = document.createElement("canvas");
            const displayW = elements.display.clientWidth;
            const displayH = elements.display.clientHeight;
            tempCanvas.width = displayW;
            tempCanvas.height = displayH;
            tempCanvas.getContext("2d").drawImage(elements.uploadedImage, 0, 0, displayW, displayH);
            faceBox = await detectFaceWithTimeout(tempCanvas);
            if (faceBox) state.lastFaceBox = faceBox;
        } catch (e) {
            console.warn("Face detection failed:", e);
        }

        // 2. Classificar
        await predict(elements.uploadedImage);
        document.getElementById("result").classList.remove("is-loading");

        loading.style.display = "none";

        // 3. Posicionar overlay on ja sabem que hi ha la cara
        if (state.currentStyle && faceBox) {
            positionOverlay(faceBox);
        }

        // 4. Afegir a la galeria (amb overlay ja posicionat)
        addToGallery();
        if (state.popupEnabled) {
            resultPage.capture(elements, state);
        }

        // 5. Tornar al tracking en viu
        setTimeout(async () => {
            elements.uploadedImage.style.display = "none";
            document.getElementById("webcam-canvas").style.display = "block";
            await state.webcam.play();
            requestAnimationFrame(updateWebcam);
        }, 1000);

    }, 50);
});




/**
 * Processa una imatge pujada per l'usuari i executa la predicció
 */
elements.imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("result-placeholder")?.remove();


    if (state.isWebcamActive) stopWebcam();

    const reader = new FileReader();
    reader.onload = async (event) => {
        showImage(event.target.result);
        elements.uploadedImage.classList.remove("captured");  // Treure classe
        elements.uploadedImage.onload = () => predict(elements.uploadedImage);
        elements.overlay.style.display = "none";
        state.currentStyle = null;
    };
    reader.readAsDataURL(file);
});

elements.modeSwitch.addEventListener("change", (e) => {
    state.kidMode = e.target.checked;
    updateLabels();

    if (state.currentStyle) {
        const names = state.kidMode ? CONFIG.names.kid : CONFIG.names.adult;
        elements.predictedClass.textContent = names[state.currentStyle];
    }
});


elements.popupSwitch.addEventListener("change", (e) => {
    state.popupEnabled = e.target.checked;
});

function updateLabels() {
    const names = state.kidMode ? CONFIG.names.kid : CONFIG.names.adult;
    for (const key in names) {
        const label = document.getElementById(`label-${key.toLowerCase()}`);
        if (label) label.textContent = names[key] + ":";
    }
}


elements.resetBtn.addEventListener("click", () => {
    resetValues();
});

/**
 * Reseteja els valors de la classificació anterior
 */
function resetValues() {
    state.currentStyle = null;
    state.currentOverlay = null;
    state.lastFaceBox = null;
    state.smoothBox = null;
    elements.overlay.style.display = "none";
    elements.predictedClass.textContent = "-";
    elements.confidence.textContent = "-";
    elements.resetBtn.style.display = "none";

    // Resetejam les barres de progress
    for (const key in CONFIG.names.adult) {
        const id = key.toLowerCase();
        const bar = document.getElementById(`prob-${id}`);
        const val = document.getElementById(`val-${id}`);
        if (bar) bar.value = 0;
        if (val) val.textContent = "0%";
    }

}


/**
 * Renderitzar galeria als costats
 */
function addToGallery() {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Capture the image data RIGHT NOW as a snapshot
    const snapshot = new Image();
    snapshot.src = elements.uploadedImage.src;

    const ol = elements.overlay;
    const hasOverlay = ol.style.display !== "none" && state.currentStyle;
    const olSrc = ol.src;
    const olLeft = parseFloat(ol.style.left);
    const olTop = parseFloat(ol.style.top);
    const olWidth = parseFloat(ol.style.width);
    const displayW = elements.display.clientWidth;
    const displayH = elements.display.clientHeight;

    const draw = () => {
        ctx.drawImage(snapshot, 0, 0, 400, 400);

        if (hasOverlay) {
            const overlayImg = new Image();
            overlayImg.src = olSrc;

            const finalize = () => {
                const scaleX = 400 / displayW;
                const scaleY = 400 / displayH;
                const x = olLeft * scaleX;
                const y = olTop * scaleY;
                const w = olWidth * scaleX;
                const h = overlayImg.naturalHeight * (w / overlayImg.naturalWidth);

                ctx.drawImage(overlayImg, x, y, w, h);
                appendToGalleryGrid(canvas.toDataURL("image/jpeg", 0.5));
            };

            if (overlayImg.complete) finalize();
            else overlayImg.onload = finalize;
        } else {
            appendToGalleryGrid(canvas.toDataURL("image/jpeg", 0.5));
        }
    };

    if (snapshot.complete) draw();
    else snapshot.onload = draw;
}
let galleryCount = 0;

function appendToGalleryGrid(dataURL) {
    const leftGrid = document.querySelector("#gallery-left .gallery-grid");
    const rightGrid = document.querySelector("#gallery-right .gallery-grid");
    const target = galleryCount % 2 === 0 ? leftGrid : rightGrid;
    galleryCount++;

    const names = state.kidMode ? CONFIG.names.kid : CONFIG.names.adult;
    const style = state.currentStyle;
    const conf = elements.confidence.textContent;

    const polaroid = document.createElement("div");
    polaroid.className = "polaroid";
    polaroid.style.setProperty("--rotation", (Math.random() * 6 - 3) + "deg");

    polaroid.innerHTML = `
        <img src="${dataURL}">
        <div class="polaroid-caption">
            ${style ? (names[style] || style) : "?"}
           <!-- <div class="polaroid-confidence">${conf}</div> -->
        </div>
    `;

    target.appendChild(polaroid);
    galleryQueue.push(polaroid);

    if (galleryQueue.length > MAX_GALLERY) {
        const oldest = galleryQueue.shift();
        oldest.remove();
    }
}



function smoothBox(newBox, factor = 0.30) {
    if (!state.smoothBox) {
        state.smoothBox = { ...newBox };
        return state.smoothBox;
    }
    state.smoothBox.xCenter += (newBox.xCenter - state.smoothBox.xCenter) * factor;
    state.smoothBox.yCenter += (newBox.yCenter - state.smoothBox.yCenter) * factor;
    state.smoothBox.width += (newBox.width - state.smoothBox.width) * factor;
    state.smoothBox.height += (newBox.height - state.smoothBox.height) * factor;
    return state.smoothBox;
}


init();
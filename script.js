const MODEL_URL = "https://teachablemachine.withgoogle.com/models/bMXg8u3wX/";
const THRESHOLD = 0.3;//0.7;

const state = {
    model: null,
    maxPredictions: 0,
    webcam: null,
    isWebcamActive: false,
    currentStyle: null,
    isDetecting: false,
    lastFaceBox: null,
    kidMode: false
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
    resetBtn: document.getElementById("reset-btn")

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
                    state.lastFaceBox = box;
                    positionOverlay(box);
                } else {
                    elements.overlay.style.display = "none";
                }
            } catch (e) {
            }
            state.isDetecting = false;
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
        elements.confidence.textContent = `Confiança: ${(best.probability * 100).toFixed(1)}%`;
        //elements.overlay.src = CONFIG.overlays[best.className];
        // Comentat per testejar els Overlays:
        //elements.overlay.src=CONFIG.overlays[0]; // OldMoney
        //elements.overlay.src=CONFIG.overlays[1]; // Streetwear
        //elements.overlay.src=CONFIG.overlays[2]; // CottageCore
        elements.overlay.src=CONFIG.overlays[3]; // Rockstar

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
        yOffset = height * 1.2;
    } else if (state.currentStyle === "CottageCore") {
        yOffset = height * 1;
    }

    elements.overlay.style.top = (y - yOffset) + "px";
}

/**
 * Captura el frame actual de la webcam i executa la predicció
 * Lógica de detecció facial + posicionament del overlay de l'estil classificat
 */
elements.captureBtn.addEventListener("click", async () => {
    if (!state.webcam) return;

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
    loading.style.display = "block";

    // 2. Classificar la imatge estática
    setTimeout(async () => {
        await predict(elements.uploadedImage);
        loading.style.display = "none";

        if (state.currentStyle && state.lastFaceBox) {
            positionOverlay(state.lastFaceBox);
        }
        // Després 1 segon, amagar la imatge estàtica i tornar al tracking en viu
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

document.getElementById("mode-switch").addEventListener("change", (e) => {
    state.kidMode = e.target.checked;
    updateLabels();

    if (state.currentStyle) {
        const names = state.kidMode ? CONFIG.names.kid : CONFIG.names.adult;
        elements.predictedClass.textContent = names[state.currentStyle];
    }
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

function resetValues() {
    state.currentStyle = null;
    state.currentOverlay = null;
    state.lastFaceBox = null;
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




init();
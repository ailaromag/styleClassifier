const MODEL_URL = "https://teachablemachine.withgoogle.com/models/bMXg8u3wX/";
const THRESHOLD = 0.7;

const state = {
    model: null,
    maxPredictions: 0,
    webcam: null,
    isWebcamActive: false,
    currentStyle: null
};

const elements = {
    webcamBtn: document.getElementById("webcam-btn"),
    captureBtn: document.getElementById("capture-btn"),
    imageInput: document.getElementById("image-input"),
    uploadedImage: document.getElementById("uploaded-image"),
    predictedClass: document.getElementById("predicted-class"),
    confidence: document.getElementById("confidence"),
    display: document.getElementById("display"),
    overlay: document.getElementById("overlay")

};

const overlays = {
    "OldMoney": "img/crown.png",
    "Streetwear": "img/cap.png",
    "CottageCore": "img/flowers.png",
    "Rockstar": "img/glasses.png"
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
    document.getElementById("webcam-canvas")?.remove();
    elements.captureBtn.style.display = "none";
    elements.overlay.style.display = "none";
    state.isWebcamActive = false;
    state.currentStyle = null;
    elements.webcamBtn.textContent = "Activar Webcam";

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
 * Actualitza el frame de la webcam.
 */
async function updateWebcam() { // Ara és async perque utilitzam await per la detecció facial
    if (state.isWebcamActive && state.webcam) {
        state.webcam.update();
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
        elements.predictedClass.textContent = best.className;
        state.currentStyle = best.className;
        elements.confidence.textContent = `Confiança: ${(best.probability * 100).toFixed(1)}%`;
        document.getElementById("overlay").src = overlays[best.className];
        document.getElementById("overlay").style.display = "block";

    } else {
        elements.predictedClass.textContent = "Classe desconeguda";
        elements.confidence.textContent = "Cap predicció supera el llindar";
        state.currentStyle = null;
        document.getElementById("overlay").style.display = "none";
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
 * Captura el frame actual de la webcam i executa la predicció
 * Lógica de detecció facial + posicionament del overlay de l'estil classificat
 */
elements.captureBtn.addEventListener("click", async () => {
    if (!state.webcam) return;
    const imageDataURL = state.webcam.canvas.toDataURL("image/png");
    stopWebcam();
    showImage(imageDataURL);
    elements.uploadedImage.classList.add("captured");  // Afegir classe
    await predict(elements.uploadedImage);


    // Detecció de la cara en la imatge capturada:
    if (state.currentStyle) {
        // Detectar cara amb MediaPipe
        let detectedBox = null;

        state.faceDetector.onResults((results) => {
            if (results.detections.length > 0) {
                detectedBox = results.detections[0].boundingBox;
            }
        });

        await state.faceDetector.send({ image: elements.uploadedImage });



        if (detectedBox) {
            // MediaPipe retorna coordenades normalitzades (0-1)
            const displayW = elements.display.clientWidth;
            const displayH = elements.display.clientHeight;

            const x = detectedBox.xCenter - detectedBox.width / 2;
            const y = detectedBox.yCenter - detectedBox.height / 2;

            console.log("Box normalitzat:", x, y, detectedBox.width, detectedBox.height);
            console.log("Display:", displayW, displayH);

            elements.overlay.src = overlays[state.currentStyle];
            elements.overlay.style.display = "block";
            const overlayWidth = detectedBox.width * displayW;
            elements.overlay.style.width = overlayWidth + "px";
            elements.overlay.style.left = (detectedBox.xCenter * displayW ) + "px";
            elements.overlay.style.top = ((y - detectedBox.height * 1) * displayH) + "px";
        }
    }

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

init();
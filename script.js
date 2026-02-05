const MODEL_URL = "https://teachablemachine.withgoogle.com/models/bMXg8u3wX/";
const THRESHOLD = 0.7;

const state = {
    model: null,
    maxPredictions: 0,
    webcam: null,
    isWebcamActive: false
};

const elements = {
    webcamBtn: document.getElementById("webcam-btn"),
    captureBtn: document.getElementById("capture-btn"),
    imageInput: document.getElementById("image-input"),
    uploadedImage: document.getElementById("uploaded-image"),
    predictedClass: document.getElementById("predicted-class"),
    confidence: document.getElementById("confidence"),
    display: document.getElementById("display")
};


/**
 * Carrega el model de Teachable Machine des de la URL 
 */
async function init() {
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
    state.isWebcamActive = false;
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
    elements.captureBtn.style.display = "block";
    state.isWebcamActive = true;
    elements.webcamBtn.textContent = "Desactivar Webcam";

    requestAnimationFrame(updateWebcam);
}

function updateWebcam() {
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
        elements.confidence.textContent = `Confiança: ${(best.probability * 100).toFixed(1)}%`;
        
    } else {
        elements.predictedClass.textContent = "Classe desconeguda";
        elements.confidence.textContent = "Cap predicció supera el llindar";
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
 */
elements.captureBtn.addEventListener("click", async () => {
    if (!state.webcam) return;

    const imageDataURL = state.webcam.canvas.toDataURL("image/png");
    stopWebcam();
    showImage(imageDataURL);
    elements.uploadedImage.classList.add("captured");  // Afegir classe
    await predict(elements.uploadedImage);
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
    };
    reader.readAsDataURL(file);
});

init();
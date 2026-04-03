class ResultPage {
    constructor(config) {
        this.config = config;
        this.themeCSS = '';
        this._loadTheme();
    }

    async _loadTheme() {
        try {
            const [themeRes, themesRes] = await Promise.all([
                fetch('theme.css'),
                fetch('themes.css')
            ]);
            this.themeCSS = await themeRes.text();
            this.themesCSS = await themesRes.text();
        } catch (e) {
            console.warn('Could not load stylesheets:', e);
        }
    }

    capture(elements, state) {
        const rawConfidence = elements.confidence.textContent;
        const confidenceValue = rawConfidence.replace('amb confiança del:', '').trim();
        const data = {
            imageSrc: elements.uploadedImage.src,
            style: state.currentStyle,
            styleName: this._getStyleName(state),
            confidence: confidenceValue,
            overlay: this._getOverlayData(elements),
            display: {
                w: elements.display.clientWidth,
                h: elements.display.clientHeight
            },
            probabilities: this._getProbabilities(state)
        };

        this._render(data);
    }

    _getStyleName(state) {
        const names = state.kidMode ? this.config.names.kid : this.config.names.adult;
        return names[state.currentStyle] || state.currentStyle || "-";
    }

    _getOverlayData(elements) {
        const ol = elements.overlay;
        if (ol.style.display === "none") return null;
        return {
            src: ol.src,
            left: parseFloat(ol.style.left),
            top: parseFloat(ol.style.top),
            width: parseFloat(ol.style.width)
        };
    }

    _getProbabilities(state) {
        const names = state.kidMode ? this.config.names.kid : this.config.names.adult;
        const probs = [];
        for (const key in this.config.names.adult) {
            const id = key.toLowerCase();
            probs.push({
                label: names[key],
                value: document.getElementById(`val-${id}`)?.textContent || "0%",
                percent: document.getElementById(`prob-${id}`)?.value || 0
            });
        }
        return probs;
    }

    _render(data) {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d");

        const snapshot = new Image();
        snapshot.src = data.imageSrc;

        const draw = () => {
            ctx.drawImage(snapshot, 0, 0, 400, 400);

            const finalize = (overlayImg) => {
                if (overlayImg && data.overlay) {
                    const sx = 400 / data.display.w;
                    const sy = 400 / data.display.h;
                    const w = data.overlay.width * sx;
                    const h = overlayImg.naturalHeight * (w / overlayImg.naturalWidth);
                    ctx.drawImage(overlayImg, data.overlay.left * sx, data.overlay.top * sy, w, h);
                }
                this._openTab(canvas.toDataURL("image/png"), data);
            };

            if (data.overlay) {
                const img = new Image();
                img.src = data.overlay.src;
                img.complete ? finalize(img) : img.onload = () => finalize(img);
            } else {
                finalize(null);
            }
        };

        snapshot.complete ? draw() : snapshot.onload = draw;
    }

    _openTab(imageData, data) {
        const themeClass = `theme-${data.style.toLowerCase()}`;
        const probsHTML = data.probabilities.map(p => `
            <div class="prob-bar">
                <span class="prob-label">${p.label}:</span>
                <div class="prob-track">
                    <div class="prob-fill" style="width:${p.percent}%"></div>
                </div>
                <span class="prob-value">${p.value}</span>
            </div>`).join("");

        const html = `<!DOCTYPE html>
<html lang="ca">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Raleway:wght@300;400&display=swap" rel="stylesheet">
    <title>El meu estil: ${data.styleName}</title>
    <style>
        /* Theme variables */
        ${this.themeCSS}
        ${this.themesCSS}

        /* Page layout */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: var(--font-body);
            font-weight: 300;
        }

        body {
            padding: 2rem;
            background-color: var(--bg-warm);
            background-image: var(--texture-dots);
            background-blend-mode: overlay;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }

        body::after {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: 0.1;
            background-image: var(--texture-noise);
        }

        /* Card */
        .card {
            background-color: var(--paper-white);
            background-image: var(--texture-gloss), var(--texture-grain);
            background-size: 200% 100%, auto;
            padding: 1.5rem;
            border-radius: 0.4rem;
            box-shadow: var(--shadow-soft);
            border: 1px solid rgba(0, 0, 0, 0.05);
            max-width: 500px;
            width: 100%;
            position: relative;
            z-index: 1;
            align-self: flex-start;
        }

        /* Image */
        .card-image {
            width: 100%;
            border-radius: 4px;
            display: block;
        }

        /* Result row */
        .result-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.5rem 0;
        }

        .result-label {
            font-family: var(--font-heading);
            font-size: 1.15rem;
            color: var(--text-dark);
        }

        .result-style {
            font-family: var(--font-heading);
            font-size: 1.3rem;
            font-weight: bold;
            color: var(--text-dark);
        }

        .result-confidence {
            font-family: var(--font-heading);
            font-size: 1rem;
            color: var(--text-muted);
        }

        /* Probabilities */
        .probs-title {
            font-family: var(--font-heading);
            font-size: 1.2rem;
            color: var(--text-dark);
            margin: 0.2rem 0;
            text-align: left;
        }

        .prob-bar {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            margin-bottom: 0.35rem;
            font-size: 0.85rem;
        }

        .prob-label {
            width: 7.5rem;
            min-width: 7.5rem;
            white-space: nowrap;
            text-align: left;
        }

        .prob-track {
            flex: 1;
            height: 0.75rem;
            background-color: var(--grey-light);
            border-radius: 4px;
            overflow: hidden;
        }

        .prob-fill {
            height: 100%;
            background-color: var(--accent);
            border-radius: 4px;
        }

        .prob-value {
            min-width: 3rem;
            text-align: right;
        }

        .download-btn {
            display: block;
            max-width: 500px;
            width: 100%;
            margin: 0.75rem auto 0;
            padding: 0.55rem;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 4px;
            font-family: var(--font-body);
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.15rem;
            cursor: pointer;
        }

    </style>
</head>
<body class="${themeClass}">
    <div class="card">
        <img class="card-image" src="${imageData}" alt="Captured style">

        <div class="result-row">
            <span class="result-confidence">${data.confidence}</span>
            <span class="result-style">${data.styleName}</span>
        </div>

        <h2 class="probs-title">Probabilitats:</h2>
        ${probsHTML}
    </div>    
</body>
</html>`;

        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const w = 420, h = 650;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        window.open(url, "_blank", `popup,width=${w},height=${h},left=${left},top=${top}`);
    }
}
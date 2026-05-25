(function () {
  'use strict';

  /* ── DOM ── */
  const photoInput = document.getElementById('photoInput');
  const nameInput = document.getElementById('employeeName');
  const uploadZone = document.getElementById('uploadZone');
  const uploadSub = document.getElementById('uploadSub');
  const canvas = document.getElementById('previewCanvas');
  const placeholder = document.getElementById('previewPlaceholder');
  const successEl = document.getElementById('previewSuccess');
  const downloadBtn = document.getElementById('downloadBtn');
  const templateAsset = document.getElementById('templateAsset');
  const previewWrap = document.getElementById('previewWrap');
  const placeholderText = document.getElementById('previewPlaceholderText');

  const TEMPLATE_PATH = 'assets/EidT.png';

  let templateLoadStarted = false;
  let templateLoaded = false;

  /* ── Canvas size ── */
  const BASE_CANVAS_SIZE = 1080;
  const REF_TEMPLATE_SIZE = 1600;

  const REF_LAYOUT = {
    photo: { x: 164, y: 414, width: 543, height: 687 },
    nameGap: 78
  };

  const NAME_COLOR = '#d93d15';
  const NAME_FONT_REF = 48;
  const NAME_FONT_WEIGHT = 700;

  let CW = BASE_CANVAS_SIZE;
  let CH = BASE_CANVAS_SIZE;

  function scaleRefLayout(w) {
    const s = w / REF_TEMPLATE_SIZE;

    return {
      photo: {
        x: Math.round(REF_LAYOUT.photo.x * s),
        y: Math.round(REF_LAYOUT.photo.y * s),
        width: Math.round(REF_LAYOUT.photo.width * s),
        height: Math.round(REF_LAYOUT.photo.height * s)
      },
      nameGap: Math.round(REF_LAYOUT.nameGap * s)
    };
  }

  let PHOTO_BOX = scaleRefLayout(BASE_CANVAS_SIZE).photo;
  let NAME_GAP = scaleRefLayout(BASE_CANVAS_SIZE).nameGap;

  let NAME_X = PHOTO_BOX.x + PHOTO_BOX.width / 2;
  let NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + NAME_GAP;

  function updateNamePosition() {
    NAME_X = PHOTO_BOX.x + PHOTO_BOX.width / 2;
    NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + NAME_GAP;
  }

  function applyCalibratedLayout(w) {
    const layout = scaleRefLayout(w);

    PHOTO_BOX = layout.photo;
    NAME_GAP = layout.nameGap;

    updateNamePosition();
  }

  function syncPreviewDisplaySize() {
    if (!previewWrap || !canvas) return;

    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function resolveTemplateUrl() {
    const src =
      (templateAsset && templateAsset.getAttribute('src')) ||
      TEMPLATE_PATH;

    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src;
    }
  }

  function setPreviewState(state) {
    if (previewWrap) {
      previewWrap.dataset.state = state;
    }
  }

  function showPlaceholderMessage(message) {
    if (placeholderText) {
      placeholderText.textContent = message;
    }

    setPreviewState('loading');
  }

  let tplCanvas = null;
  let photoOriginal = null;
  let nameTimer = null;

  /* ── TEMPLATE ── */

  function onTemplateLoadFail() {
    if (templateLoaded) return;

    console.warn('Template load failed');

    showPlaceholderMessage(
      'Template not found. Check assets/EidT.png'
    );

    tplCanvas = createFallbackTemplate();

    renderCanvas();
  }

  function tryLoadTemplate() {
    if (templateLoadStarted) return;

    templateLoadStarted = true;

    showPlaceholderMessage('Loading template...');

    const img = new Image();

    img.onload = function () {
      if (!img.naturalWidth || !img.naturalHeight) {
        onTemplateLoadFail();
        return;
      }

      buildTplCanvas(img);
    };

    img.onerror = onTemplateLoadFail;

    img.src = resolveTemplateUrl();

    setTimeout(function () {
      if (!templateLoaded) {
        onTemplateLoadFail();
      }
    }, 15000);
  }

  function createFallbackTemplate() {
    const off = document.createElement('canvas');

    off.width = CW;
    off.height = CH;

    const ctx = off.getContext('2d');

    ctx.fillStyle = '#f8f2e8';
    ctx.fillRect(0, 0, CW, CH);

    return off;
  }

  function buildTplCanvas(img) {
    CW = img.naturalWidth;
    CH = img.naturalHeight;

    applyCalibratedLayout(CW);

    const off = document.createElement('canvas');

    off.width = CW;
    off.height = CH;

    const ctx = off.getContext('2d');

    ctx.drawImage(img, 0, 0, CW, CH);

    tplCanvas = off;

    templateLoaded = true;

    renderCanvas();
  }

  /* ── PHOTO ── */

  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Select JPG, PNG, WEBP');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Max 10MB');
      return;
    }

    markUploadReady(file.name);

    const reader = new FileReader();

    reader.onload = function (e) {
      const img = new Image();

      img.onload = function () {
        photoOriginal = img;

        renderCanvas();

        downloadBtn.disabled = false;

        showSuccess();
      };

      img.onerror = function () {
        alert('Cannot read image');
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  }

  /* ── FIXED DRAW LOGIC ── */
  /* SAME FOR PREVIEW + DOWNLOAD */

  function drawPhoto(ctx, img) {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;

    const box = PHOTO_BOX;

    const scale = Math.max(
      box.width / srcW,
      box.height / srcH
    ) * 1.25;

    const dw = srcW * scale;
    const dh = srcH * scale;

    const dx = box.x + (box.width - dw) / 2;
    const dy = box.y + (box.height - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ── MAIN COMPOSITE ── */

  function paintComposite(ctx) {

    /* IMPORTANT FIX */
    ctx.clearRect(0, 0, CW, CH);

    /* PHOTO */
    if (photoOriginal) {

      ctx.save();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      drawPhoto(ctx, photoOriginal);

      ctx.restore();
    }

    /* TEMPLATE */
    if (tplCanvas) {
      ctx.drawImage(tplCanvas, 0, 0, CW, CH);
    }

    /* NAME */
    drawName(ctx, nameInput.value);
  }

  function renderCanvas() {
    if (!tplCanvas) return;

    const ctx = canvas.getContext('2d');

    canvas.width = CW;
    canvas.height = CH;

    paintComposite(ctx);

    setPreviewState('ready');

    downloadBtn.disabled = !photoOriginal;

    syncPreviewDisplaySize();
  }

  /* ── NAME ── */

  function getNameFontSize() {
    const scale = CW / REF_TEMPLATE_SIZE;

    return Math.max(
      30,
      Math.round(NAME_FONT_REF * scale)
    );
  }

  function splitNameIntoLines(name, ctx, fontFamily) {
    const words = name.trim().split(/\s+/);

    if (!words.length) return [];

    const size = getNameFontSize();

    ctx.font = `${NAME_FONT_WEIGHT} ${size}px ${fontFamily}`;

    const maxWidth = PHOTO_BOX.width * 1.2;

    const lines = [];

    let line = '';

    words.forEach(function (word) {

      const candidate = line
        ? line + ' ' + word
        : word;

      if (ctx.measureText(candidate).width <= maxWidth) {

        line = candidate;

      } else {

        if (line) {
          lines.push(line);
        }

        line = word;
      }
    });

    if (line) {
      lines.push(line);
    }

    return lines;
  }

  function paintNameLines(ctx, name, fontFamily) {

    const size = getNameFontSize();

    const lineGap = 10;

    const lines = splitNameIntoLines(
      name,
      ctx,
      fontFamily
    );

    if (!lines.length) return;

    ctx.font = `${NAME_FONT_WEIGHT} ${size}px ${fontFamily}`;

    ctx.textAlign = 'center';

    ctx.textBaseline = 'alphabetic';

    const totalH =
      lines.length * size +
      (lines.length - 1) * lineGap;

    const startY =
      NAME_Y - totalH / 2 + size;

    lines.forEach(function (line, i) {

      const ly =
        startY + i * (size + lineGap);

      ctx.lineWidth = 2.5;

      ctx.strokeStyle = 'rgba(255,255,255,0.95)';

      ctx.strokeText(line, NAME_X, ly);

      ctx.fillStyle = NAME_COLOR;

      ctx.fillText(line, NAME_X, ly);
    });
  }

  function drawName(ctx, rawName) {

    const name = (rawName || '').trim();

    if (!name) return;

    ctx.save();

    paintNameLines(
      ctx,
      name,
      "Inter, Arial, sans-serif"
    );

    ctx.restore();
  }

  /* ── DOWNLOAD ── */

  function waitForFonts() {

    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }

    const size = getNameFontSize();

    return Promise.all([
      document.fonts.ready,
      document.fonts.load(
        `${NAME_FONT_WEIGHT} ${size}px Inter`
      )
    ]);
  }

  function triggerFileDownload(url, isObjectUrl) {

    const a = document.createElement('a');

    a.style.display = 'none';

    a.download = 'eid-mubarak-chuti.png';

    a.href = url;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    if (isObjectUrl) {
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 15000);
    }
  }

  function downloadComposite() {

    const exportCanvas =
      document.createElement('canvas');

    exportCanvas.width = CW;
    exportCanvas.height = CH;

    const ctx = exportCanvas.getContext('2d');

    paintComposite(ctx);

    exportCanvas.toBlob(function (blob) {

      if (!blob) {
        alert('Download failed');
        return;
      }

      const url = URL.createObjectURL(blob);

      triggerFileDownload(url, true);

    }, 'image/png', 1);
  }

  /* ── HELPERS ── */

  function showSuccess() {

    if (!successEl) return;

    successEl.hidden = false;

    setTimeout(function () {
      successEl.hidden = true;
    }, 1200);
  }

  function markUploadReady(name) {

    uploadZone.classList.add('ready');

    const mainEl =
      uploadZone.querySelector('.upload-main');

    if (mainEl) {
      mainEl.innerHTML =
        '<strong>' + esc(name) + '</strong>';
    }

    if (uploadSub) {
      uploadSub.textContent =
        'Photo selected · click to change';
    }
  }

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])
    );
  }

  /* ── EVENTS ── */

  photoInput.addEventListener(
    'change',
    () => loadPhoto(photoInput.files[0])
  );

  nameInput.addEventListener('input', function () {

    nameInput.value =
      nameInput.value.toUpperCase();

    clearTimeout(nameTimer);

    nameTimer = setTimeout(renderCanvas, 100);
  });

  uploadZone.addEventListener('dragover', function (e) {

    e.preventDefault();

    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', function () {

    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', function (e) {

    e.preventDefault();

    uploadZone.classList.remove('drag-over');

    loadPhoto(e.dataTransfer.files[0]);
  });

  uploadZone.addEventListener('keydown', function (e) {

    if (e.key === 'Enter' || e.key === ' ') {

      e.preventDefault();

      photoInput.click();
    }
  });

  downloadBtn.addEventListener('click', function () {

    if (!photoOriginal) return;

    downloadBtn.disabled = true;

    waitForFonts()
      .then(function () {

        renderCanvas();

        downloadComposite();
      })
      .catch(function (e) {

        console.error(e);

        alert('Download failed');
      })
      .finally(function () {

        downloadBtn.disabled = false;
      });
  });

  window.addEventListener(
    'resize',
    syncPreviewDisplaySize
  );

  /* ── INIT ── */

  function initApp() {
    tryLoadTemplate();
  }

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      initApp
    );

  } else {

    initApp();
  }

})();
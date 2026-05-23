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
  const NAME_COLOR = '#7a0c18';
  const PHOTO_SCALE = 1.08;
  const NAME_LINE_REF = 'Mozammel Hosain';
  const NAME_FONT_REF = 54;

  let CW = BASE_CANVAS_SIZE, CH = BASE_CANVAS_SIZE;

  function getCanvasScale() {
    return CW / BASE_CANVAS_SIZE;
  }

  function scaleRefLayout(w, h) {
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

  let PHOTO_BOX = scaleRefLayout(BASE_CANVAS_SIZE, BASE_CANVAS_SIZE).photo;
  let NAME_GAP = scaleRefLayout(BASE_CANVAS_SIZE, BASE_CANVAS_SIZE).nameGap;
  let NAME_X = PHOTO_BOX.x + Math.round(PHOTO_BOX.width / 2);
  let NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + NAME_GAP;

  function updateNamePosition() {
    NAME_X = PHOTO_BOX.x + Math.round(PHOTO_BOX.width / 2);
    NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + NAME_GAP;
  }

  function applyCalibratedLayout(w, h) {
    const layout = scaleRefLayout(w, h);
    PHOTO_BOX = layout.photo;
    NAME_GAP = layout.nameGap;
    updateNamePosition();
  }

  function detectTransparentArch(data, w, h) {
    const xLimit = Math.floor(w * 0.62);
    let minx = w, miny = h, maxx = 0, maxy = 0;
    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < xLimit; x += step) {
        const a = data[(y * w + x) * 4 + 3];
        if (a < 40) {
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
    }
    if (maxx <= minx || maxy <= miny) return null;
    const pad = Math.max(12, Math.round(18 * (w / REF_TEMPLATE_SIZE)));
    const box = {
      x: minx + pad,
      y: miny + pad,
      width: (maxx - minx) - pad * 2,
      height: (maxy - miny) - pad * 2
    };
    if (box.width < 80 || box.height < 80) return null;
    return box;
  }

  function syncPreviewDisplaySize() {
    if (!previewWrap || !canvas) return;
    const cssW = previewWrap.clientWidth;
    if (!cssW) return;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  function resolveTemplateUrl() {
    const src = (templateAsset && templateAsset.getAttribute('src')) || TEMPLATE_PATH;
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return src;
    }
  }

  function setPreviewState(state) {
    if (previewWrap) previewWrap.dataset.state = state;
  }

  function showPlaceholderMessage(message) {
    if (placeholderText) placeholderText.textContent = message;
    setPreviewState('loading');
  }
 
  let tplCanvas = null;
  let photoBitmap = null;
  let photoOriginal = null;
  let nameTimer = null;

  /* ── TEMPLATE ── */
  function onTemplateLoadFail() {
    if (templateLoaded) return;
    console.warn('Template image could not load:', resolveTemplateUrl());
    showPlaceholderMessage('Template not found. Check assets/EidT.png is uploaded.');
    tplCanvas = createFallbackTemplate();
    renderCanvas();
  }

  function tryLoadTemplate() {
    if (templateLoadStarted) return;
    templateLoadStarted = true;
    showPlaceholderMessage('Loading template…');

    const url = resolveTemplateUrl();
    const img = new Image();
    let templateOrigin = '';
    try {
      templateOrigin = new URL(url).origin;
    } catch (e) { /* keep empty */ }
    if (
      templateOrigin &&
      templateOrigin !== window.location.origin &&
      (location.protocol === 'http:' || location.protocol === 'https:')
    ) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = function () {
      if (!img.naturalWidth || !img.naturalHeight) {
        onTemplateLoadFail();
        return;
      }
      buildTplCanvas(img);
    };
    img.onerror = onTemplateLoadFail;
    img.src = url;

    setTimeout(function () {
      if (!templateLoaded) onTemplateLoadFail();
    }, 15000);
  }

  function createFallbackTemplate() {
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const ctx = off.getContext('2d');

    ctx.fillStyle = '#f8f2e8';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.25)';
    ctx.lineWidth = 16;
    ctx.strokeRect(18, 18, CW - 36, CH - 36);

    // No cutting — template stays fully intact
    return off;
  }

  function buildTplCanvas(img) {
    if (img.naturalWidth && img.naturalHeight && (img.naturalWidth !== CW || img.naturalHeight !== CH)) {
      CW = img.naturalWidth;
      CH = img.naturalHeight;
    }

    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;

    // Draw template WITHOUT cutting — keep it fully intact
    ctx.drawImage(img, 0, 0, CW, CH);

    // Detect transparent arch cutout (EidT.png uses alpha, not a white fill)
    try {
      const imgData = ctx.getImageData(0, 0, CW, CH);
      const detected = detectTransparentArch(imgData.data, CW, CH);
      if (detected) {
        PHOTO_BOX = detected;
        const layout = scaleRefLayout(CW, CH);
        NAME_GAP = layout.nameGap;
        updateNamePosition();
      } else {
        applyCalibratedLayout(CW, CH);
      }
    } catch (e) {
      console.warn('Template auto-detect failed:', e);
      applyCalibratedLayout(CW, CH);
    }

    tplCanvas = off;
    templateLoaded = true;
    if (photoOriginal) {
      try { photoBitmap = cropToBitmap(photoOriginal); } catch { photoBitmap = null; }
    }
    renderCanvas();
  }

  /* ── PHOTO LOADING ── */
  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return alert('Select JPG, PNG, WEBP');
    if (file.size > 10 * 1024 * 1024) return alert('Max 10 MB');

    markUploadReady(file.name);

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        photoOriginal = img;
        try { photoBitmap = cropToBitmap(img); } catch { photoBitmap = null; }
        try {
          renderCanvas();
        } catch (e) {
          console.warn('renderCanvas error:', e);
        }
        downloadBtn.disabled = false;
        showSuccess();
      };
      img.onerror = function () { alert('Cannot read image'); };
      img.src = e.target.result;
    };
    reader.onerror = function () { alert('Cannot read file'); };
    reader.readAsDataURL(file);
  }

  function cropToBitmap(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(PHOTO_BOX.width / iw, PHOTO_BOX.height / ih);
    const sw = iw * scale;
    const sh = ih * scale;

    const off = document.createElement('canvas');
    off.width = PHOTO_BOX.width;
    off.height = PHOTO_BOX.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, (PHOTO_BOX.width - sw) / 2, (PHOTO_BOX.height - sh) / 2, sw, sh);
    return off;
  }

  function paintComposite(ctx, opts) {
    opts = opts || {};
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    if (photoBitmap || photoOriginal) {
      const drawW = Math.round(PHOTO_BOX.width * PHOTO_SCALE);
      const drawH = Math.round(PHOTO_BOX.height * PHOTO_SCALE);
      const drawX = PHOTO_BOX.x - Math.round((drawW - PHOTO_BOX.width) / 2);
      const drawY = PHOTO_BOX.y - Math.round((drawH - PHOTO_BOX.height) / 2);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const drawSource = photoBitmap || photoOriginal;
      if (photoBitmap) {
        ctx.drawImage(photoBitmap, drawX, drawY, drawW, drawH);
      } else {
        const srcW = drawSource.naturalWidth || drawSource.width;
        const srcH = drawSource.naturalHeight || drawSource.height;
        const scale = Math.max(drawW / srcW, drawH / srcH);
        const dw = srcW * scale;
        const dh = srcH * scale;
        ctx.drawImage(drawSource,
          drawX + (drawW - dw) / 2,
          drawY + (drawH - dh) / 2,
          dw, dh
        );
      }
      ctx.restore();
    }

    if (tplCanvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tplCanvas, 0, 0, CW, CH);
    }

    if (opts.export) {
      drawNameSystem(ctx, nameInput.value);
    } else {
      drawName(ctx, nameInput.value);
    }
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

  function waitForFonts() {
    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    const size = getNameFontSize();
    return Promise.all([
      document.fonts.ready,
      document.fonts.load('800 ' + size + 'px Inter'),
      document.fonts.load('700 ' + size + 'px Inter')
    ]).catch(function () { return undefined; });
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
      setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    }
  }

  function downloadComposite() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CW;
    exportCanvas.height = CH;
    paintComposite(exportCanvas.getContext('2d'), { export: true });

    if (typeof exportCanvas.toBlob === 'function') {
      exportCanvas.toBlob(function (blob) {
        if (blob && blob.size > 0) {
          triggerFileDownload(URL.createObjectURL(blob), true);
          return;
        }
        saveDataUrl(exportCanvas);
      }, 'image/png', 1);
      return;
    }
    saveDataUrl(exportCanvas);
  }

  function saveDataUrl(exportCanvas) {
    const dataUrl = exportCanvas.toDataURL('image/png');
    if (!dataUrl || dataUrl.length < 100) {
      throw new Error('empty export');
    }
    triggerFileDownload(dataUrl, false);
  }

  function getNameFontSize() {
    const scale = CW / REF_TEMPLATE_SIZE;
    return Math.max(34, Math.round(NAME_FONT_REF * scale));
  }

  function splitNameIntoLines(name, ctx, fontFamily) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const size = getNameFontSize();
    ctx.font = `800 ${size}px ${fontFamily}`;
    const maxWidth = ctx.measureText(NAME_LINE_REF).width + ctx.measureText('M').width;

    const lines = [];
    let line = '';
    words.forEach(function (word) {
      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }
      if (line) lines.push(line);
      line = word;
    });
    if (line) lines.push(line);
    return lines;
  }

  function paintNameLines(ctx, name, fontFamily) {
    const scale = CW / REF_TEMPLATE_SIZE;
    const size = getNameFontSize();
    const lineGap = Math.max(8, Math.round(10 * scale));
    const lines = splitNameIntoLines(name, ctx, fontFamily);
    if (!lines.length) return;
    ctx.font = `800 ${size}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const totalH = lines.length * size + (lines.length - 1) * lineGap;
    const startY = NAME_Y - totalH / 2 + size;
    const outline = Math.max(2, Math.round(2.5 * scale));
    lines.forEach(function (line, i) {
      const ly = startY + i * (size + lineGap);
      ctx.lineWidth = outline;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeText(line, NAME_X, ly);
      ctx.fillStyle = NAME_COLOR;
      ctx.fillText(line, NAME_X, ly);
    });
  }

  function drawNameSystem(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    ctx.save();
    paintNameLines(ctx, name, 'Arial, Helvetica, sans-serif');
    ctx.restore();
  }

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    paintNameLines(ctx, name, "Inter, Arial, 'Helvetica Neue', sans-serif");
    ctx.restore();
  }

  /* ── UI HELPERS ── */
  function showSuccess() {
    if (!successEl) return;
    successEl.classList.remove('fade-out');
    successEl.style.animation = 'none';
    successEl.hidden = false;
    void successEl.offsetWidth;
    successEl.style.animation = '';
    setTimeout(function () {
      successEl.classList.add('fade-out');
      setTimeout(function () {
        successEl.hidden = true;
        successEl.classList.remove('fade-out');
      }, 100);
    }, 100);
  }
  function markUploadReady(name) {
    uploadZone.classList.add('ready');
    const mainEl = uploadZone.querySelector('.upload-main');
    if (mainEl) mainEl.innerHTML = '<strong>' + esc(name) + '</strong>';
    if (uploadSub) uploadSub.textContent = 'Photo selected · click to change';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  /* ── EVENTS ── */
  photoInput.addEventListener('change', () => loadPhoto(photoInput.files[0]));
  nameInput.addEventListener('input', () => { clearTimeout(nameTimer); nameTimer = setTimeout(renderCanvas, 200); });

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); loadPhoto(e.dataTransfer.files[0]); });
  uploadZone.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); photoInput.click(); } });

  downloadBtn.addEventListener('click', function () {
    if (!photoOriginal || downloadBtn.disabled) return;

    if (location.protocol === 'file:') {
      alert('Download works after you host this site online (GitHub Pages) or via Live Server — not from a saved HTML file.');
      return;
    }

    downloadBtn.disabled = true;
    waitForFonts().then(function () {
      renderCanvas();
      try {
        downloadComposite();
      } catch (e) {
        console.error(e);
        alert('Download failed. Refresh the page, upload your photo again, then try Download.');
      }
    }).catch(function () {
      renderCanvas();
      try {
        downloadComposite();
      } catch (e) {
        console.error(e);
        alert('Download failed. Refresh the page, upload your photo again, then try Download.');
      }
    }).finally(function () {
      downloadBtn.disabled = !photoOriginal;
    });
  });

  window.addEventListener('resize', syncPreviewDisplaySize);

  function initApp() {
    tryLoadTemplate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  /* ── Eid Salami Popup ── */
  (function () {
    const overlay = document.getElementById('salamiOverlay');
    const closeBtn = document.getElementById('salamiClose');
    const countEl = document.getElementById('timerCount');
    if (!overlay) return;

    let seconds = 5;
    const interval = setInterval(function () {
      seconds--;
      if (countEl) countEl.textContent = seconds;
      if (seconds <= 0) closePopup();
    }, 1000);

    function closePopup() {
      clearInterval(interval);
      overlay.classList.add('hide');
      setTimeout(function () { overlay.style.display = 'none'; }, 350);
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup();
    });
  }());

  /* ── bKash number click-to-copy ── */
  (function () {
    var toast = document.getElementById('copyToast');
    var hideTimer;

    document.querySelectorAll('[data-copy]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var num = el.getAttribute('data-copy');
        if (!num) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(showToast).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }

        function fallbackCopy() {
          var ta = document.createElement('textarea');
          ta.value = num;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast();
        }
      });

      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });

    function showToast() {
      if (!toast) return;
      clearTimeout(hideTimer);
      toast.hidden = false;
      toast.classList.add('show');
      hideTimer = setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.hidden = true; }, 300);
      }, 1800);
    }
  }());
})();
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


  /* ── Canvas size ── */
  const CW = 1080, CH = 1080;

  // start with a sensible default; we'll auto-detect from the template when it loads
  let PHOTO_BOX = {
    x: 48,
    y: 200,
    width: 520,
    height: 700
  };

  let NAME_X = PHOTO_BOX.x + PHOTO_BOX.width / 2;
  let NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + 64;
 
  let tplCanvas = null;
  let photoBitmap = null;
  let photoOriginal = null;
  let nameTimer = null;

  /* ── TEMPLATE ── */
  function tryLoadTemplate() {
    // If there is no external template image element, always fall back.
    if (!templateAsset) {
      tplCanvas = createFallbackTemplate();
      renderCanvas();
      return;
    }

    // If the image is already loaded and valid, build from it.
    if (templateAsset.complete && templateAsset.naturalWidth > 0) {
      buildTplCanvas(templateAsset);
      return;
    }

    // Otherwise, wait for load / error.
    templateAsset.onload = function () { buildTplCanvas(templateAsset); };
    templateAsset.onerror = function () {
      tplCanvas = createFallbackTemplate();
      renderCanvas();
    };
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
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const ctx = off.getContext('2d');

    // Draw template WITHOUT cutting — keep it fully intact
    ctx.drawImage(img, 0, 0, CW, CH);

    // Only auto-detect arch area from the template image (for PHOTO_BOX coords, not for cutting)
    try {
      const imgData = ctx.getImageData(0, 0, CW, CH);
      const data = imgData.data;
      const w = CW, h = CH;
      let minx = w, miny = h, maxx = 0, maxy = 0;
      const xLimit = Math.floor(w * 0.62); // search left ~62%
      const step = 2; // sample every Nth pixel for speed
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < xLimit; x += step) {
          const i = (y * w + x) * 4;
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          const lum = 0.2126*r + 0.7152*g + 0.0722*b;
          if (a > 200 && lum > 230) {
            if (x < minx) minx = x;
            if (y < miny) miny = y;
            if (x > maxx) maxx = x;
            if (y > maxy) maxy = y;
          }
        }
      }
      if (maxx > minx && maxy > miny) {
        // expand more to avoid anti-aliased fringe from the template border
        const padX = Math.round((maxx - minx) * 0.10) + 12;
        const padY = Math.round((maxy - miny) * 0.06) + 12;
        PHOTO_BOX = {
          x: Math.max(0, minx - padX),
          y: Math.max(0, miny - padY),
          width: Math.min(w - 1, (maxx - minx) + padX*2),
          height: Math.min(h - 1, (maxy - miny) + padY*2)
        };
        NAME_X = PHOTO_BOX.x + Math.round(PHOTO_BOX.width / 2);
        NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + 48;
      } else {
        // no reliable detection — fall back to percentage-based box
        PHOTO_BOX = {
          x: Math.round(CW * 0.044),
          y: Math.round(CW * 0.185),
          width: Math.round(CW * 0.481),
          height: Math.round(CW * 0.648)
        };
        NAME_X = PHOTO_BOX.x + Math.round(PHOTO_BOX.width / 2);
        NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + 48;
      }
    } catch (e) {
      // if getImageData is blocked (cross-origin) or other error, fall back to
      // percentage-based coordinates so behavior is consistent under http:// and file://
      console.warn('Template auto-detect failed:', e);
      PHOTO_BOX = {
        x: Math.round(CW * 0.044),
        y: Math.round(CW * 0.185),
        width: Math.round(CW * 0.481),
        height: Math.round(CW * 0.648)
      };
      NAME_X = PHOTO_BOX.x + Math.round(PHOTO_BOX.width / 2);
      NAME_Y = PHOTO_BOX.y + PHOTO_BOX.height + 48;
    }

    tplCanvas = off;
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
    off.width = PHOTO_BOX.width; off.height = PHOTO_BOX.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(img, (PHOTO_BOX.width - sw) / 2, (PHOTO_BOX.height - sh) / 2, sw, sh);
    return off;
  }

  /* ── RENDER ── */
  function renderCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    canvas.width = CW; canvas.height = CH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // 1️⃣ Draw uploaded photo (clipped to arch only, with padding to reduce size)
    if (photoBitmap || photoOriginal) {
      ctx.save();
      // Clip to arch shape — this is the ONLY constraint on the image
      roundedArchPath(ctx, PHOTO_BOX.x, PHOTO_BOX.y, PHOTO_BOX.width, PHOTO_BOX.height, 44);
      ctx.clip();

      // Add padding to reduce image size
      const paddingFactor = 0.12; // 12% padding on each side, 76% image
      const innerW = Math.round(PHOTO_BOX.width * (1 - paddingFactor * 2));
      const innerH = Math.round(PHOTO_BOX.height * (1 - paddingFactor * 2));
      const innerX = PHOTO_BOX.x + Math.round(PHOTO_BOX.width * paddingFactor);
      const innerY = PHOTO_BOX.y + Math.round(PHOTO_BOX.height * paddingFactor);

      // Draw image scaled to inner box
      const drawSource = photoBitmap || photoOriginal;
      if (photoBitmap) {
        ctx.drawImage(photoBitmap, innerX, innerY, innerW, innerH);
      } else {
        const srcW = drawSource.naturalWidth || drawSource.width;
        const srcH = drawSource.naturalHeight || drawSource.height;
        const scale = Math.max(innerW / srcW, innerH / srcH);
        const dw = srcW * scale;
        const dh = srcH * scale;
        ctx.drawImage(drawSource,
          innerX + (innerW - dw) / 2,
          innerY + (innerH - dh) / 2,
          dw, dh
        );
      }
      ctx.restore();
    }

    // 2️⃣ Draw template FULLY (completely intact, no cutting, no modification)
    // — this ensures the template design is never damaged
    if (tplCanvas) ctx.drawImage(tplCanvas, 0, 0);

    // 3️⃣ Draw name
    drawName(ctx, nameInput.value);

    canvas.hidden = false;
    placeholder.hidden = true;
    downloadBtn.disabled = !photoOriginal;
  }

  function drawName(ctx, rawName) {
    const name = (rawName || '').trim();
    if (!name) return;
    ctx.save();
    const size = 24;
    const lineGap = 6;
    ctx.font = `700 ${size}px 'Cinzel', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Remove shadow effects for crisp colors
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    var words = name.split(/\s+/);
    var lines = [];
    if (words.length <= 2) {
      lines = [name];
    } else {
      var mid = Math.ceil(words.length / 2);
      lines.push(words.slice(0, mid).join(' '));
      lines.push(words.slice(mid).join(' '));
    }

    var totalH = lines.length * size + (lines.length - 1) * lineGap;
    var startY = NAME_Y - totalH / 2 + size;

    for (var i = 0; i < lines.length; i++) {
      var ly = startY + i * (size + lineGap);
      ctx.fillStyle = '#d93d15';
      ctx.fillText(lines[i], NAME_X, ly);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(lines[i], NAME_X, ly);
    }
    ctx.restore();
  }

  // Draw a smooth arch-like path (rounded rectangle approximation) used to
  // cut a window from the template and to clip the user's photo.
  function roundedArchPath(ctx, x, y, width, height, radius) {
    // For simplicity we approximate the arch with a rounded rectangle
    // which fits well with the templated artwork.
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
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

  downloadBtn.addEventListener('click', () => {
    if (!photoOriginal || downloadBtn.disabled) return;
    try {
      canvas.toBlob(function (blob) {
        if (!blob) {
          fallbackDownload();
          return;
        }
        const a = document.createElement('a');
        a.download = 'eid-mubarak-chuti.png';
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }, 'image/png');
    } catch (e) {
      fallbackDownload();
    }

    function fallbackDownload() {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = 'eid-mubarak-chuti.png';
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e2) {
        alert('Download failed. Tip: Open the page via a local web server (e.g. Live Server) instead of file://');
      }
    }
  });

  tryLoadTemplate();

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
document.addEventListener('DOMContentLoaded', () => {
  const portraitListLeft   = document.getElementById('portrait-list-left');
  const portraitListRight  = document.getElementById('portrait-list-right');
  const welcomePlaceholder = document.getElementById('welcome-placeholder');
  const gridContainer      = document.getElementById('grid-container');
  const flipGrid           = document.getElementById('flip-grid');
  const gridLinesOverlay   = document.getElementById('grid-lines-overlay');
  
  const btnLang  = document.getElementById('btn-lang');
  const langText = document.getElementById('lang-text');
  const btnVoice = document.getElementById('btn-voice');
  
  let currentLang = 'ta'; // Tamil as primary language
  let activeReformer = null;
  let currentAudio = null;
  let isPlaying = false;

  const translations = {
    en: {
      voices: "Voices of Renaissance",
      voicesSubtitle: "VOICES OF INDIAN RENAISSANCE",
      impact: "Impact on Society",
      welcomeTitle: "Select a Reformer",
      welcomeDesc: "Click on a portrait to explore their life and legacy.",
      back: "Back",
      btnLangToggle: "தமிழ்", // Opposite lang text for toggle
      voicePlay: "Voice",
      voiceStop: "Stop"
    },
    ta: {
      voices: "மறுமலர்ச்சியின் குரல்கள்",
      voicesSubtitle: "இந்திய மறுமலர்ச்சியின் குரல்கள்",
      impact: "சமூகத்தில் தாக்கம்",
      welcomeTitle: "ஒரு சீர்திருத்தவாதியைத் தேர்ந்தெடுக்கவும்",
      welcomeDesc: "வாழ்க்கை மற்றும் பாரம்பரியத்தை அறிய உருவப்படத்தைக் கிளிக் செய்யவும்.",
      back: "பின்செல்",
      btnLangToggle: "ENGLISH", // Opposite lang text for toggle
      voicePlay: "குரல்",
      voiceStop: "நிறுத்து"
    }
  };

  function updateUILanguage() {
    const t = translations[currentLang];
    
    // Update main page title
    const mainTitle = document.getElementById('main-page-title');
    if (mainTitle) mainTitle.textContent = t.voices;
    
    // Update Welcome
    welcomePlaceholder.querySelector('h2').textContent = t.welcomeTitle;
    welcomePlaceholder.querySelector('p').textContent = t.welcomeDesc;
    
    // Update Nav buttons
    const backBtn = document.querySelector('.btn-back');
    if (backBtn && backBtn.childNodes.length > 2) {
      backBtn.childNodes[2].textContent = " " + t.back;
    }
    langText.textContent = t.btnLangToggle;
    
    const voiceBtn = document.getElementById('btn-voice');
    if (voiceBtn && voiceBtn.childNodes.length > 2) {
      voiceBtn.childNodes[2].textContent = " " + (isPlaying ? t.voiceStop : t.voicePlay);
    }

    // Update sidebars
    document.querySelectorAll('.portrait-item').forEach(item => {
      const idx = item.dataset.index;
      const r = reformersData[idx];
      item.querySelector('.name-overlay').textContent = r[currentLang].name;
    });

    // If currently viewing a card, immediately rebuild the text
    if (activeReformer && !isAnimating) {
      buildScrollableContent(activeReformer);
    }
    
    // Stop audio if language changes
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      isPlaying = false;
      const voiceBtn = document.getElementById('btn-voice');
      if (voiceBtn && voiceBtn.childNodes.length > 2) {
        voiceBtn.childNodes[2].textContent = " " + translations[currentLang].voicePlay;
      }
    }
  }

  btnLang.addEventListener('click', () => {
    currentLang = currentLang === 'ta' ? 'en' : 'ta';
    updateUILanguage();
  });

  const { ipcRenderer } = require('electron');
  const path = require('path');

  btnVoice.addEventListener('click', async () => {
    if (!activeReformer) return; // Do nothing if no reformer is selected
    
    const t = translations[currentLang];
    
    if (isPlaying && currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      isPlaying = false;
      btnVoice.childNodes[2].textContent = " " + t.voicePlay;
    } else {
      btnVoice.childNodes[2].textContent = " Loading...";
      btnVoice.style.opacity = "0.7";
      btnVoice.style.pointerEvents = "none";
      
      try {
        const textToSpeak = activeReformer[currentLang].desc;
        const audioFileName = `${activeReformer.id}_desc_${currentLang}.wav`;
        const outputPath = path.join(__dirname, '..', 'assets', 'cards', 'card2', audioFileName);
        
        // Request generation with high priority (resolves instantly if already exists)
        await ipcRenderer.invoke('generate-tts', {
          text: textToSpeak,
          lang: currentLang,
          outputPath: outputPath,
          priority: true
        });
        
        // Add a timestamp to bypass browser cache if the file was just regenerated
        const audioUrl = `../assets/cards/card2/${audioFileName}?t=` + Date.now();
        currentAudio = new Audio(audioUrl);
        
        currentAudio.play().catch(e => {
          console.error("Audio playback failed or file not found:", audioUrl, e);
        });
        
        isPlaying = true;
        btnVoice.childNodes[2].textContent = " " + t.voiceStop;
        
        // Auto-reset when audio ends
        currentAudio.addEventListener('ended', () => {
          isPlaying = false;
          btnVoice.childNodes[2].textContent = " " + t.voicePlay;
          currentAudio = null;
        });
      } catch (err) {
        console.error("TTS Generation Error:", err);
        btnVoice.childNodes[2].textContent = " Error";
      } finally {
        btnVoice.style.opacity = "1";
        btnVoice.style.pointerEvents = "auto";
      }
    }
  });

  const COLS = 10, ROWS = 10, TOTAL = 100;

  // ══════════════════════════════════════════════════════
  //  1. Build 100 flip cells (fronts + backs)
  // ══════════════════════════════════════════════════════
  const cells = [];
  for (let i = 0; i < TOTAL; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const cell  = document.createElement('div');
    cell.className = 'flip-cell';

    const inner = document.createElement('div');
    inner.className = 'flip-inner';

    const front = document.createElement('div');
    front.className = 'flip-front';
    const bpX = col === 0 ? '0%' : `${(col / (COLS - 1)) * 100}%`;
    const bpY = row === 0 ? '0%' : `${(row / (ROWS - 1)) * 100}%`;
    front.style.backgroundPosition = `${bpX} ${bpY}`;

    const back = document.createElement('div');
    back.className = 'flip-back';
    back.style.backgroundPosition = `${bpX} ${bpY}`;

    inner.appendChild(front);
    inner.appendChild(back);
    cell.appendChild(inner);
    flipGrid.appendChild(cell);

    cells.push({ cell, inner, front, back, row, col });
  }

  // ══════════════════════════════════════════════════════
  //  2. Build grid line overlays (9 H + 9 V)
  // ══════════════════════════════════════════════════════
  const hLines = [], vLines = [];
  for (let n = 1; n <= 9; n++) {
    const hLine = document.createElement('div');
    hLine.className = 'grid-line-h';
    hLine.style.top = `${n * 10}%`;
    gridLinesOverlay.appendChild(hLine);
    hLines.push(hLine);

    const vLine = document.createElement('div');
    vLine.className = 'grid-line-v';
    vLine.style.left = `${n * 10}%`;
    gridLinesOverlay.appendChild(vLine);
    vLines.push(vLine);
  }

  // ══════════════════════════════════════════════════════
  //  3. Render square versions for 10x10 flip grid
  // ══════════════════════════════════════════════════════
  function loadSquareImage(reformer) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const SIZE = 1000;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#fdfaf6';
        ctx.fillRect(0, 0, SIZE, SIZE);

        let sw = img.width, sh = img.height;
        let dw = SIZE, dh = SIZE;
        if (sw > sh) { dh = (sh / sw) * SIZE; } else { dw = (sw / sh) * SIZE; }
        const dx = (SIZE - dw) / 2;
        const dy = (SIZE - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(reformer.image);
      img.src = reformer.image;
    });
  }

  function renderPosterCanvas(reformer, baseImageDataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 1000;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0, SIZE, SIZE);

        ctx.fillStyle = 'rgba(245, 238, 223, 0.85)';
        ctx.fillRect(0, 0, SIZE, SIZE);

        function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
          const words = text.split(' ');
          let line = ''; let lines = 0;
          for (let w = 0; w < words.length; w++) {
            const test = line + words[w] + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
              ctx.fillText(line.trim(), x, y);
              line = words[w] + ' '; y += lineHeight; lines++;
              if (maxLines && lines >= maxLines) {
                ctx.fillText('...', x, y); return y + lineHeight;
              }
            } else { line = test; }
          }
          ctx.fillText(line.trim(), x, y);
          return y + lineHeight;
        }

        const content = reformer[currentLang];
        const t = translations[currentLang];

        let cursorY = 120;
        const W = SIZE - 80;

        ctx.fillStyle = 'rgba(140, 90, 43, 0.8)';
        ctx.font = '600 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.voicesSubtitle, SIZE / 2, cursorY);
        cursorY += 70;

        ctx.fillStyle = '#8c5a2b';
        ctx.font = 'bold 74px Outfit, sans-serif';
        ctx.fillText(content.name, SIZE / 2, cursorY);
        cursorY += 50;

        ctx.fillStyle = 'rgba(92, 74, 61, 0.8)';
        ctx.font = '600 28px Outfit, sans-serif';
        ctx.fillText(`${reformer.years}  •  ${content.title}`, SIZE / 2, cursorY);
        cursorY += 100;

        ctx.fillStyle = '#8c5a2b';
        ctx.font = 'italic 34px Outfit, sans-serif';
        ctx.fillStyle = 'rgba(140, 90, 43, 0.2)';
        ctx.font = 'bold 120px serif';
        ctx.fillText('"', 120, cursorY + 30);
        ctx.fillStyle = '#8c5a2b';
        ctx.font = 'italic 34px Outfit, sans-serif';
        cursorY = wrapText(content.quote, SIZE / 2, cursorY, W - 160, 44, 4);
        cursorY += 80;

        ctx.fillStyle = '#5c4a3d';
        ctx.font = '28px Outfit, sans-serif';
        wrapText(content.desc, SIZE / 2, cursorY, W - 80, 40, 5);

        resolve(canvas.toDataURL('image/png'));
      };
      img.src = baseImageDataUrl;
    });
  }

  function buildScrollableContent(reformer) {
    const sc = document.getElementById('scrollable-content');
    const content = reformer[currentLang];
    const t = translations[currentLang];
    
    sc.style.backgroundImage = `url('${reformer.image}')`;
    
    let impactsHtml = '';
    if (content.impactDetails && content.impactDetails.length > 0) {
      impactsHtml = `
        <div class="sc-section-title">${t.impact}</div>
        <div class="sc-impact-grid">
          ${content.impactDetails.map(detail => `
            <div class="sc-impact-col">
              <div class="sc-impact-heading">
                ${iconMap[detail.heading] || ''} ${detail.heading}
              </div>
              <ul class="sc-reforms">
                ${detail.points.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      `;
    }

    sc.innerHTML = `
      <div class="sc-inner">
        <div class="sc-card-box sc-top-card">
          <div class="sc-header">
            <div class="sc-subtitle">${t.voicesSubtitle}</div>
            <div class="sc-title">${content.name}</div>
            <div class="sc-years">${reformer.years} &nbsp;•&nbsp; ${content.title}</div>
          </div>
          <div class="sc-quote">${content.quote}</div>
          <div class="sc-desc">${content.desc}</div>
        </div>
        
        <div class="sc-card-box sc-bottom-card">
          ${impactsHtml}
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════
  //  4. Animation sequence controller
  // ══════════════════════════════════════════════════════
  let activeTimers = [];
  let isAnimating = false;

  const ENTRANCE_CLASSES = ['enter-from-left', 'enter-from-right', 'enter-from-top', 'enter-from-bottom'];

  function clearTimers() {
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
  }

  function delay(ms) {
    return new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      activeTimers.push(t);
    });
  }

  async function showReformerDetails(reformer) {
    if (isAnimating) return;
    isAnimating = true;
    activeReformer = reformer;
    clearTimers();
    
    // Stop any playing audio when switching reformers
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      isPlaying = false;
      btnVoice.childNodes[2].textContent = " " + translations[currentLang].voicePlay;
    }

    gridLinesOverlay.classList.remove('complete');
    gridLinesOverlay.style.opacity = '1';
    gridLinesOverlay.style.transition = 'none';
    hLines.forEach(l => l.classList.remove('drawn'));
    vLines.forEach(l => l.classList.remove('drawn'));

    ENTRANCE_CLASSES.forEach(c => gridContainer.classList.remove(c));

    cells.forEach(({ cell, inner }) => {
      inner.style.transition = 'none';
      cell.classList.remove('flipped');
    });

    welcomePlaceholder.style.display = 'none';
    gridContainer.classList.remove('hidden');
    
    const sc = document.getElementById('scrollable-content');
    sc.classList.remove('visible');

    const squareImgData = await loadSquareImage(reformer);
    const posterDataUrl = await renderPosterCanvas(reformer, squareImgData);

    cells.forEach(({ front }) => {
      front.style.backgroundImage = `url('${squareImgData}')`;
    });

    cells.forEach(({ back }) => {
      back.style.backgroundImage = `url('${posterDataUrl}')`;
    });

    const randomDir = ENTRANCE_CLASSES[Math.floor(Math.random() * ENTRANCE_CLASSES.length)];
    void gridContainer.offsetWidth;
    gridContainer.classList.add(randomDir);

    await delay(700);

    for (let n = 0; n < 9; n++) {
      const t = setTimeout(() => hLines[n].classList.add('drawn'), n * 60);
      activeTimers.push(t);
    }
    for (let n = 0; n < 9; n++) {
      const t = setTimeout(() => vLines[n].classList.add('drawn'), n * 60);
      activeTimers.push(t);
    }

    await delay(9 * 60 + 600 + 200);

    gridLinesOverlay.classList.add('complete');
    await delay(400);

    cells.forEach(({ inner }) => {
      inner.style.transition = '';
    });

    await delay(200);

    let maxFlipDelay = 0;
    cells.forEach(({ cell, row, col }) => {
      const flipDelay = (row + col) * 50 + 100;
      if (flipDelay > maxFlipDelay) maxFlipDelay = flipDelay;
      const t = setTimeout(() => cell.classList.add('flipped'), flipDelay);
      activeTimers.push(t);
    });

    const hideDelay = maxFlipDelay + 800;
    const tHide = setTimeout(() => {
      gridLinesOverlay.style.transition = 'opacity 0.5s ease';
      gridLinesOverlay.style.opacity = '0';
      
      buildScrollableContent(reformer);
      document.getElementById('scrollable-content').classList.add('visible');
      
      isAnimating = false;
    }, hideDelay);
    activeTimers.push(tHide);
  }

  // ══════════════════════════════════════════════════════
  //  5. Render sidebar portraits (Split across left and right)
  // ══════════════════════════════════════════════════════
  reformersData.forEach((reformer, index) => {
    const item = document.createElement('div');
    item.className = 'portrait-item';
    item.dataset.index = index;
    item.innerHTML = `
      <img src="${reformer.image}" alt="${reformer.name}"
           onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
      <div class="name-overlay"></div>
    `;

    item.addEventListener('click', () => {
      if (isAnimating) return;
      document.querySelectorAll('.portrait-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      showReformerDetails(reformer);
    });

    if (index < 3) {
      portraitListLeft.appendChild(item);
    } else {
      portraitListRight.appendChild(item);
    }
  });

  // Initialize Language State
  updateUILanguage();
});

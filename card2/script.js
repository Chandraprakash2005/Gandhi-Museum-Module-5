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
      welcomeTitle: "சீர்திருத்தவாதியைத் தேர்ந்தெடுக்கவும்",
      welcomeDesc: "உருவப்படத்தைக் கிளிக் செய்யவும்.",
      back: "பின்செல்",
      btnLangToggle: "ENG", // Opposite lang text for toggle
      voicePlay: "குரல்",
      voiceStop: "நிறுத்து"
    }
  };

  function updateUILanguage() {
    const t = translations[currentLang];
    
    // Toggle body class for language-specific styling
    if (currentLang === 'ta') {
      document.body.classList.add('lang-ta');
      document.body.classList.remove('lang-en');
    } else {
      document.body.classList.add('lang-en');
      document.body.classList.remove('lang-ta');
    }
    
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
        const content = activeReformer[currentLang];
        let textToSpeak = `${content.name}. ${activeReformer.years}. ${content.title}. ${content.desc}. ${content.quote}.`;
        
        if (content.impactDetails && content.impactDetails.length > 0) {
          content.impactDetails.forEach(detail => {
            textToSpeak += ` ${detail.heading}.`;
            detail.points.forEach(point => {
              textToSpeak += ` ${point}`;
            });
          });
        }
        
        const audioFileName = `${activeReformer.id}_full_${currentLang}.wav`;
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
        
        // Use JPEG instead of PNG for 10x-50x faster encoding on the Raspberry Pi
        resolve(canvas.toDataURL('image/jpeg', 0.85));
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

        ctx.fillStyle = 'rgba(245, 238, 223, 0.95)'; // Must be almost opaque for text readability
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

        const isTa = currentLang === 'ta';
        let cursorY = 120;
        const W = SIZE - 80;

        ctx.fillStyle = 'rgba(140, 90, 43, 0.8)';
        ctx.font = isTa ? '600 20px Outfit, sans-serif' : '600 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.voicesSubtitle, SIZE / 2, cursorY);
        cursorY += isTa ? 60 : 70;

        ctx.fillStyle = '#8c5a2b';
        ctx.font = isTa ? 'bold 48px Outfit, sans-serif' : 'bold 74px Outfit, sans-serif';
        ctx.fillText(content.name, SIZE / 2, cursorY);
        cursorY += isTa ? 45 : 50;

        ctx.fillStyle = 'rgba(92, 74, 61, 0.8)';
        ctx.font = isTa ? '600 22px Outfit, sans-serif' : '600 28px Outfit, sans-serif';
        ctx.fillText(`${reformer.years}  •  ${content.title}`, SIZE / 2, cursorY);
        cursorY += isTa ? 85 : 100;

        ctx.fillStyle = '#8c5a2b';
        ctx.fillStyle = 'rgba(140, 90, 43, 0.2)';
        ctx.font = isTa ? 'bold 90px serif' : 'bold 120px serif';
        ctx.fillText('"', 120, cursorY + (isTa ? 20 : 30));
        ctx.fillStyle = '#8c5a2b';
        ctx.font = isTa ? 'italic 24px Outfit, sans-serif' : 'italic 34px Outfit, sans-serif';
        cursorY = wrapText(content.quote, SIZE / 2, cursorY, W - 160, isTa ? 34 : 44, 4);
        cursorY += isTa ? 60 : 80;

        ctx.fillStyle = '#5c4a3d';
        ctx.font = isTa ? '20px Outfit, sans-serif' : '28px Outfit, sans-serif';
        // Fast JPEG encoding
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => {
        console.error("Poster Canvas: Failed to load image", baseImageDataUrl);
        const SIZE = 1000;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f5eedf'; // Solid background fallback for JPEG
        ctx.fillRect(0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
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
          <div class="sc-desc">${content.desc}</div>
          <div class="sc-quote">${content.quote}</div>
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
      // Don't push to activeTimers so the promise can always resolve, avoiding deadlocks!
      setTimeout(resolve, ms);
    });
  }

  let currentExecId = 0;

  async function showReformerDetails(reformer) {
    if (isAnimating) return;
    const execId = ++currentExecId;
    isAnimating = true;
    activeReformer = reformer;
    clearTimers();
    
    // INSTANTLY hide the grid the exact millisecond the user clicks so the old card vanishes
    gridContainer.style.visibility = 'hidden';
    
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

    // Instantly snap all flips back to the front face
    cells.forEach(({ cell, inner }) => {
      inner.style.transition = 'none';
      cell.classList.remove('flipped');
    });

    welcomePlaceholder.style.display = 'none';
    gridContainer.classList.remove('hidden');
    document.getElementById('content-center').classList.add('card-active');
    
    const sc = document.getElementById('scrollable-content');
    sc.style.transition = 'none'; // instantly remove fade-out delay
    sc.classList.remove('visible');
    
    // Update the content immediately so the DOM is ready and NEVER shows the old data
    buildScrollableContent(reformer);
    
    // Restore the transition for when it needs to fade back in later
    void sc.offsetWidth; // force reflow
    sc.style.transition = '';

    // Compute the square image dynamically (lightning fast JPEG)
    if (!reformer.squareImage) {
      reformer.squareImage = await loadSquareImage(reformer);
    }
    const squareImgData = reformer.squareImage;

    // Assign the new perfectly-cropped image to the front face
    cells.forEach(({ front }) => {
      front.style.backgroundImage = `url('${squareImgData}')`;
    });
    
    // Force the browser to register the new background images
    void gridContainer.offsetWidth;
    
    // VITAL: Yield exactly 1 frame so the graphics card can upload the new image texture 
    // while the grid is STILL INVISIBLE. This is the only way to prevent the old image from flashing!
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (execId !== currentExecId) return;

    // Now unhide the grid and start the slide animation with the new image perfectly loaded
    gridContainer.style.visibility = 'visible';
    const randomDir = ENTRANCE_CLASSES[Math.floor(Math.random() * ENTRANCE_CLASSES.length)];
    gridContainer.classList.add(randomDir);

    // Give the browser 50ms to begin the slide animation smoothly
    await delay(50);
    if (execId !== currentExecId) return; // abort if interrupted

    // Generate the heavy back text-canvas while it slides
    // Changed to JPEG so this won't freeze the device
    const posterImgData = await renderPosterCanvas(reformer, squareImgData);
    if (execId !== currentExecId) return;

    // Allow the portrait to fully arrive and pause so the user can see it before the flip begins
    await delay(2000);
    if (execId !== currentExecId) return; // abort if interrupted

    cells.forEach(({ back, col, row }) => {
      const bpX = col === 0 ? '0%' : `${(col / (COLS - 1)) * 100}%`;
      const bpY = row === 0 ? '0%' : `${(row / (ROWS - 1)) * 100}%`;
      back.style.backgroundImage = `url('${posterImgData}')`;
      back.style.backgroundSize = '1000% 1000%';
      back.style.backgroundPosition = `${bpX} ${bpY}`;
    });

    // Wait for the card to shoot onto the screen before we start flipping
    await delay(100);
    if (execId !== currentExecId) return; // abort if interrupted

    // 1. Start drawing grid lines!

    // 2. Draw the grid lines quickly
    for (let n = 0; n < 9; n++) {
      const t = setTimeout(() => hLines[n].classList.add('drawn'), n * 20);
      activeTimers.push(t);
    }
    for (let n = 0; n < 9; n++) {
      const t = setTimeout(() => vLines[n].classList.add('drawn'), n * 20);
      activeTimers.push(t);
    }

    // Wait for lines to finish drawing
    await delay(9 * 20 + 50);
    gridLinesOverlay.classList.add('complete');

    cells.forEach(({ inner }) => {
      inner.style.transition = '';
    });

    // 3. Flip all the cards column-wise from top to bottom continuously and very fast
    let maxFlipDelay = 0;
    cells.forEach(({ cell, row, col }) => {
      // Spreading the math out slightly to 40ms and 25ms prevents the browser from dropping frames
      // and gives the eye a perfect, smooth, readable wave to follow.
      const flipDelay = (col * 40) + (row * 25);
      if (flipDelay > maxFlipDelay) maxFlipDelay = flipDelay;
      const t = setTimeout(() => cell.classList.add('flipped'), flipDelay);
      activeTimers.push(t);
    });

    const hideDelay = maxFlipDelay + 300;
    const tHide = setTimeout(() => {
      gridLinesOverlay.style.transition = 'opacity 0.5s ease';
      gridLinesOverlay.style.opacity = '0';
      
      document.getElementById('scrollable-content').classList.add('visible');
      
      isAnimating = false;
    }, hideDelay);
    activeTimers.push(tHide);
  }

  // ══════════════════════════════════════════════════════
  //  5. Render sidebar portraits (Split across left and right)
  // ══════════════════════════════════════════════════════
  // Instructional SVG to be injected into the first portrait
  const handSvg = `
    <div class="hand-instruction" id="hand-instruction">
      <div class="tap-ripple"></div>
      <svg width="54" height="54" viewBox="0 0 24 24" fill="#5c4a3d" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 20H15.4C16.1 20 16.7 19.4 16.7 18.7L17 14.5C17.1 13.6 16.5 12.8 15.6 12.6L13 11.8V4.5C13 3.7 12.3 3 11.5 3S10 3.7 10 4.5V13.8L6.8 12.8C6.4 12.7 6 12.8 5.7 13.1L4.5 14.3L8.9 19.2C9.5 19.7 10.2 20 11 20Z" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  reformersData.forEach((reformer, index) => {
    const item = document.createElement('div');
    item.className = 'portrait-item';
    item.dataset.index = index;
    item.innerHTML = `
      <img src="${reformer.image}" alt="${reformer.name}"
           onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
      <div class="name-overlay"></div>
      ${index === 0 ? handSvg : ''}
    `;

    item.addEventListener('click', () => {
      if (isAnimating) return;
      
      // Hide the hand instruction permanently once the user clicks any card
      const handInstruction = document.getElementById('hand-instruction');
      if (handInstruction) handInstruction.classList.add('hidden');

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

  // ══════════════════════════════════════════════════════
  //  6. Inactivity Timer (3 Minutes)
  // ══════════════════════════════════════════════════════
  let inactivityTimer;
  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      // 3 minutes of inactivity reached
      if (isPlaying && currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        isPlaying = false;
        btnVoice.childNodes[2].textContent = " " + translations[currentLang].voicePlay;
      }
      
      // Revert back to the first portrait on inactivity
      const firstPortrait = document.querySelector('.portrait-item');
      if (firstPortrait && !firstPortrait.classList.contains('active')) {
        firstPortrait.click();
      }

      // Bring back the hand instruction
      const handInstruction = document.getElementById('hand-instruction');
      if (handInstruction) handInstruction.classList.remove('hidden');

    }, 3 * 60 * 1000);
  }

  // Bind interaction events to reset the timer
  ['click', 'touchstart', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer);
  });
  
  // Start the timer initially
  resetInactivityTimer();

  // ══════════════════════════════════════════════════════
  //  7. Show first card content by default
  // ══════════════════════════════════════════════════════
  // Automatically trigger the first portrait on load so it's not hidden
  const firstPortrait = document.querySelector('.portrait-item');
  if (firstPortrait) {
    firstPortrait.click();
  }
});

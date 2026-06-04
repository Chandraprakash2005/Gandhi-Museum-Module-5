document.addEventListener('DOMContentLoaded', () => {
  const data = window.uprisingData;
  if (!data) return;

  const audioNarration = document.getElementById('audio-narration');
  
  const { ipcRenderer } = require('electron');
  const path = require('path');

  const defaultLang = localStorage.getItem('kiosk_global_lang') || 'ta';
  let panelLanguages = [defaultLang, defaultLang, defaultLang, defaultLang];
  let isVoicePlaying = false;
  let currentPlaybackQueue = [];
  let currentPlaybackIndex = 0;
  let activeLocation = null;
  let scrollTimeout;
  let isTranslating = false;

  const translations = {
    en: {
      back: "Back",
      voicePlay: "Voice",
      voiceStop: "Stop",
      mapInstruction: "Press the red dots",
      close: "Close",
      loading: "Loading..."
    },
    ta: {
      back: "பின்செல்",
      voicePlay: "குரல்",
      voiceStop: "நிறுத்து",
      mapInstruction: "சிவப்புப் புள்ளிகளை அழுத்தவும்",
      close: "மூடுக",
      loading: "ஏற்றப்படுகிறது..."
    }
  };

  // Map marker layout configurations (coordinates on the India map)
  const positions = {
    "Peshawar": { top: '12%', left: '26%', labelPos: 'left' },
    "Lahore": { top: '16%', left: '29%', labelPos: 'left' },
    "Jalandhar": { top: '17%', left: '31%', labelPos: 'right' },
    "Ambala": { top: '20%', left: '33.5%', labelPos: 'right' },
    "Saharanpur": { top: '23%', left: '35.5%', labelPos: 'right' },
    "Meerut": { top: '25.5%', left: '36.5%', labelPos: 'right' },
    "Delhi": { top: '27.5%', left: '35%', labelPos: 'left' },
    "Aligarh": { top: '28.5%', left: '37.5%', labelPos: 'right' },
    "Mathura": { top: '30%', left: '36%', labelPos: 'left' },
    "Agra": { top: '31.5%', left: '37%', labelPos: 'right' },
    "Gwalior": { top: '36%', left: '37.5%', labelPos: 'left' },
    "Bareilly": { top: '26%', left: '41.5%', labelPos: 'right' },
    "Lucknow": { top: '31%', left: '47.5%', labelPos: 'right' },
    "Kanpur": { top: '34.5%', left: '45.5%', labelPos: 'left' },
    "Jhansi": { top: '41%', left: '37.5%', labelPos: 'right' },
    "Allahabad": { top: '38.5%', left: '48.5%', labelPos: 'left' },
    "Benaras": { top: '40%', left: '50.5%', labelPos: 'right' },
    "Azamgarh": { top: '36%', left: '51.5%', labelPos: 'right' },
    "Arrah": { top: '39%', left: '55.5%', labelPos: 'right' },
    "Jabalpur": { top: '46%', left: '43.5%', labelPos: 'right' },
    "Mhow": { top: '47%', left: '31.5%', labelPos: 'right' },
    "Surat": { top: '53%', left: '20.5%', labelPos: 'right' },
    "Ahmedabad": { top: '47%', left: '19.5%', labelPos: 'left' },
    "Bombay": { top: '61%', left: '22.5%', labelPos: 'right' },
    "Aurangabad": { top: '58%', left: '28.5%', labelPos: 'right' },
    "Madurai": { top: '87%', left: '36.5%', labelPos: 'right' },
    "Cuttack": { top: '53%', left: '56.5%', labelPos: 'right' },
    "Calcutta": { top: '49%', left: '61.5%', labelPos: 'left' },
    "Dumdum": { top: '45%', left: '62.5%', labelPos: 'left' },
    "Chittagong": { top: '50%', left: '71.5%', labelPos: 'right' },
    "Barrackpore": { top: '47%', left: '62%', labelPos: 'right' }
  };

  // Setup Timeline Intersection Observer
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  // Render and update UI based on selected language
  // Render a specific panel
  function renderPanel(panelIndex) {
    const lang = panelLanguages[panelIndex];
    const t = translations[lang];
    const panels = document.querySelectorAll('.panel');
    const panel = panels[panelIndex];
    if (!panel) return;
    
    // Update this panel's specific language toggle button text
    const langTextEl = panel.querySelector('.lang-text');
    if (langTextEl) {
      langTextEl.textContent = lang === 'en' ? 'தமிழ்' : 'ENG';
    }
    
    // Update this panel's specific voice button text
    const voiceTextEl = panel.querySelector('.voice-text');
    if (voiceTextEl) {
      voiceTextEl.textContent = isVoicePlaying && getCurrentPanelIndex() === panelIndex ? t.voiceStop : t.voicePlay;
    }
    
    if (panelIndex === 0) {
      // 1. Render Hero Panel content
      document.getElementById('main-title').textContent = lang === 'ta' ? data.title_ta : data.title;
      
      const introContainer = document.getElementById('intro-text');
      introContainer.innerHTML = '';
      const descSource = lang === 'ta' ? data.description_ta : data.description;
      descSource.forEach(p => {
        const pEl = document.createElement('p');
        pEl.textContent = p;
        introContainer.appendChild(pEl);
      });

      const quotesContainer = document.getElementById('quotes-container');
      quotesContainer.innerHTML = '';
      const quotesSource = lang === 'ta' ? data.quotes_ta : data.quotes;
      quotesSource.forEach(q => {
        const qEl = document.createElement('div');
        qEl.className = 'quote-card';
        qEl.innerHTML = `
          <div class="quote-text">${q.text}</div>
          <div class="quote-author">- ${q.author}</div>
        `;
        quotesContainer.appendChild(qEl);
      });
      
      // Update Back button text
      const backBtn = document.querySelector('.btn-back');
      if (backBtn && backBtn.childNodes.length > 2) {
        backBtn.childNodes[2].textContent = " " + t.back;
      }
      
    } else if (panelIndex === 1) {
      // 2. Render Timeline Panel content
      document.getElementById('timeline-title').textContent = lang === 'ta' ? data.features.timeline.title_ta : data.features.timeline.title;
      const timelineTrack = document.getElementById('timeline-track');
      timelineTrack.innerHTML = '';
      
      const eventsSource = lang === 'ta' ? data.features.timeline.events_ta : data.features.timeline.events;
      eventsSource.forEach((ev) => {
        const evEl = document.createElement('div');
        evEl.className = 'timeline-event';
        
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        evEl.appendChild(dot);
        
        const content = document.createElement('div');
        content.className = 'timeline-content';
        
        let imageHtml = '';
        if (ev.image) {
          imageHtml = `<img src="${ev.image}" alt="${ev.title}" class="timeline-image">`;
        }

        content.innerHTML = `
          ${imageHtml}
          <div class="timeline-date">${ev.date}</div>
          <h3 class="timeline-title">${ev.title}</h3>
          <div class="timeline-desc">${ev.description}</div>
        `;
        evEl.appendChild(content);
        timelineTrack.appendChild(evEl);
      });

      // Attach IntersectionObserver to the new timeline cards
      document.querySelectorAll('.timeline-event').forEach(el => {
        observer.observe(el);
      });
      
    } else if (panelIndex === 2) {
      // 3. Render Map Panel content
      document.getElementById('map-title').textContent = lang === 'ta' ? data.features.map.title_ta : data.features.map.title;
      const mapMarkersContainer = document.getElementById('map-markers');
      mapMarkersContainer.innerHTML = '';
      
      data.features.map.locations.forEach(loc => {
        if (positions[loc.name]) {
          const marker = document.createElement('div');
          marker.className = 'map-marker';
          
          const hasDetails = loc.points && loc.points.length > 0 && loc.points[0] !== "A principal center during the 1857 revolt.";
          if (hasDetails) {
            marker.classList.add('detailed');
          }

          marker.style.top = positions[loc.name].top;
          marker.style.left = positions[loc.name].left;
          
          const label = document.createElement('span');
          label.className = 'map-label';
          label.textContent = lang === 'ta' ? loc.name_ta : loc.name;
          if (positions[loc.name].labelPos === 'left') {
            label.classList.add('label-left');
          }
          marker.appendChild(label);
          
          marker.addEventListener('click', () => showMapInfo(loc));
          mapMarkersContainer.appendChild(marker);
        }
      });

      // Update Map instructions text
      const mapInst = panel.querySelector('.map-instruction p');
      if (mapInst) {
        mapInst.textContent = t.mapInstruction;
      }
      
      // Update Map Info close button
      const closeMapInfoBtn = document.getElementById('close-map-info');
      if (closeMapInfoBtn) {
        closeMapInfoBtn.textContent = t.close;
      }

      // Refresh active location details popup if it is open
      if (activeLocation) {
        const loc = activeLocation;
        document.getElementById('map-info-title').textContent = lang === 'ta' ? loc.name_ta : loc.name;
        
        const ul = document.getElementById('map-info-points');
        if (ul) {
          ul.innerHTML = '';
          const pointsList = lang === 'ta' ? loc.points_ta : loc.points;
          pointsList.forEach(pt => {
            const li = document.createElement('li');
            li.textContent = pt;
            ul.appendChild(li);
          });
        }
        if (closeMapInfoBtn) {
          closeMapInfoBtn.textContent = t.close;
        }
      }
      
    } else if (panelIndex === 3) {
      // 4. Render Rifle Panel content
      document.getElementById('rifle-title').textContent = lang === 'ta' ? data.features.rifle.title_ta : data.features.rifle.title;
      const rifleDetails = document.getElementById('rifle-details');
      rifleDetails.innerHTML = '';
      
      const detailsSource = lang === 'ta' ? data.features.rifle.details_ta : data.features.rifle.details;
      Object.entries(detailsSource).forEach(([key, value]) => {
        const detailEl = document.createElement('div');
        detailEl.className = 'detail-item';
        
        const label = lang === 'en' ? key.replace(/([A-Z])/g, ' $1').trim() : key;
        
        detailEl.innerHTML = `
          <div class="detail-label">${label}</div>
          <div class="detail-value">${value}</div>
        `;
        rifleDetails.appendChild(detailEl);
      });
      initWeaponSlideshow();
    }
  }

  // Render and update UI based on selected language
  function renderContent() {
    panelLanguages.forEach((_, idx) => {
      renderPanel(idx);
    });
  }

  // Populate Location Details Modal
  function showMapInfo(loc) {
    activeLocation = loc;
    const lang = panelLanguages[2];
    
    document.getElementById('map-info-title').textContent = lang === 'ta' ? loc.name_ta : loc.name;
    document.getElementById('map-info-date').textContent = loc.date || '';
    
    const imageContainer = document.getElementById('map-info-image-container');
    if (imageContainer) {
      // Rebuild the slideshow layout only if we switched to a different location
      const isNewLoc = imageContainer.dataset.locId !== String(loc.id);
      if (isNewLoc) {
        imageContainer.dataset.locId = loc.id;
        imageContainer.innerHTML = `
          <div class="map-slideshow">
            <div class="map-slides"></div>
            <button class="slide-btn prev">&lt;</button>
            <button class="slide-btn next">&gt;</button>
            <div class="slide-dots"></div>
          </div>
        `;
        const slides = imageContainer.querySelector('.map-slides');
        const dots = imageContainer.querySelector('.slide-dots');
        
        const possibleImages = [
          `assets/Image/Map/Cards/${loc.name}.png`,
          `assets/Image/Map/Cards/${loc.name}1.png`,
          `assets/Image/Map/Cards/${loc.name}2.png`,
          `assets/Image/Map/Cards/${loc.name}3.png`,
          `assets/Image/Map/Cards/${loc.name}4.png`
        ];

        let slideInterval;
        const checkAndSetupSlideshow = () => {
           const allImgs = slides.querySelectorAll('img');
           if (allImgs.length === 0) {
             imageContainer.style.display = 'none';
           } else {
             imageContainer.style.display = 'block';
             if (allImgs.length === 1) {
               imageContainer.querySelector('.slide-btn.prev').style.display = 'none';
               imageContainer.querySelector('.slide-btn.next').style.display = 'none';
               dots.style.display = 'none';
             }
             allImgs[0].classList.add('active');
             const allDots = dots.querySelectorAll('.dot');
             if (allDots.length > 0) allDots[0].classList.add('active');
             
             if (allImgs.length > 1) {
               let curIdx = 0;
               const goTo = (idx) => {
                 allImgs[curIdx].classList.remove('active');
                 if (allDots[curIdx]) allDots[curIdx].classList.remove('active');
                 curIdx = idx;
                 allImgs[curIdx].classList.add('active');
                 if (allDots[curIdx]) allDots[curIdx].classList.add('active');
               };
               const next = () => goTo((curIdx + 1) % allImgs.length);
               const prev = () => goTo((curIdx - 1 + allImgs.length) % allImgs.length);
               
               imageContainer.querySelector('.slide-btn.prev').onclick = () => { prev(); resetInt(); };
               imageContainer.querySelector('.slide-btn.next').onclick = () => { next(); resetInt(); };
               allDots.forEach((dot, idx) => {
                 dot.onclick = () => { goTo(idx); resetInt(); };
               });

               const resetInt = () => {
                 clearInterval(slideInterval);
                 slideInterval = setInterval(next, 3000);
               };
               resetInt();
             }
           }
        };

        let promises = possibleImages.map(src => {
          return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const el = document.createElement('img');
              el.src = src;
              slides.appendChild(el);
              
              const dot = document.createElement('span');
              dot.className = 'dot';
              dots.appendChild(dot);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          });
        });

        Promise.all(promises).then(checkAndSetupSlideshow);
      }
    }
    
    // Populate translated bullet points
    const ul = document.getElementById('map-info-points');
    ul.innerHTML = '';
    const pointsList = lang === 'ta' ? loc.points_ta : loc.points;
    pointsList.forEach(pt => {
      const li = document.createElement('li');
      li.textContent = pt;
      ul.appendChild(li);
    });
    
    const mapInfo = document.getElementById('map-info');
    mapInfo.classList.remove('hidden');
    
    if (isVoicePlaying) {
      playActiveContextVoice();
    }
  }

  // Handle map modal closing
  const btnCloseMapInfo = document.getElementById('close-map-info');
  btnCloseMapInfo.addEventListener('click', () => {
    const mapInfo = document.getElementById('map-info');
    mapInfo.classList.add('hidden');
    activeLocation = null;
    
    if (isVoicePlaying) {
      playActiveContextVoice();
    }
  });

  // Language Change Control
  function handleLangChange(panelIndex) {
    if (panelIndex === undefined || panelIndex < 0) return;
    isTranslating = true;
    
    // Disable snapping temporarily during translation reflow
    document.documentElement.classList.add('no-snap');
    
    // Save current active panel index and relative scroll offset inside that panel
    const panelsBefore = document.querySelectorAll('.panel');
    let relativeScrollY = 0;
    // Only Timeline (index 1) needs a relative offset because it is a long scrolling section.
    // For single-screen slides (Hero, Map, Weapon), we reset relativeScrollY to 0 so they align perfectly at top.
    if (panelIndex === 1 && panelsBefore[panelIndex]) {
      relativeScrollY = window.scrollY - panelsBefore[panelIndex].offsetTop;
    }
    
    ipcRenderer.send('log', 'Language switch clicked', {
      panelIndex,
      lang: panelLanguages[panelIndex],
      scrollY: window.scrollY,
      panelBeforeOffset: panelsBefore[panelIndex] ? panelsBefore[panelIndex].offsetTop : null,
      relativeScrollY
    });
    
    panelLanguages[panelIndex] = panelLanguages[panelIndex] === 'en' ? 'ta' : 'en';
    
    const wasPlaying = isVoicePlaying && getCurrentPanelIndex() === panelIndex;
    if (wasPlaying) {
      stopVoice();
    }
    
    renderPanel(panelIndex);
    
    // Scroll to the same relative position in the newly rendered layout
    const panelsAfter = document.querySelectorAll('.panel');
    if (panelsAfter[panelIndex]) {
      const targetY = panelsAfter[panelIndex].offsetTop + relativeScrollY;
      
      ipcRenderer.send('log', 'Realigning viewport to targetY', {
        panelAfterOffset: panelsAfter[panelIndex].offsetTop,
        targetY
      });
      
      window.scrollTo(0, targetY);
      
      // Ensure snap positions are aligned after the DOM reflow completes
      setTimeout(() => {
        window.scrollTo(0, targetY);
        document.documentElement.classList.remove('no-snap');
        isTranslating = false;
        ipcRenderer.send('log', 'Snap re-enabled, scrollY is:', window.scrollY);
        if (wasPlaying) startVoice();
      }, 150); // Use 150ms to ensure the browser has completed layout on slow hardware
    } else {
      document.documentElement.classList.remove('no-snap');
      isTranslating = false;
      if (wasPlaying) startVoice();
    }
  }

  // Determine current active panel section based on viewport scroll positioning
  function getCurrentPanelIndex() {
    const panels = document.querySelectorAll('.panel');
    const scrollY = window.scrollY;
    let activeIndex = 0;
    
    // Only transition to the next panel if it occupies at least 15% of the viewport height
    const threshold = window.innerHeight * 0.15;
    
    panels.forEach((p, index) => {
      if (scrollY >= p.offsetTop - threshold) {
        activeIndex = index;
      }
    });

    // Automatically close the Map location details modal if the user scrolls away from the Map panel
    if (activeIndex !== 2 && activeLocation) {
      const mapInfo = document.getElementById('map-info');
      if (mapInfo) {
        mapInfo.classList.add('hidden');
      }
      activeLocation = null;
      if (isVoicePlaying) {
        stopVoice();
      }
    }

    return activeIndex;
  }

  // Find index of the timeline card closest to the vertical center of the screen
  function getCenteredTimelineCardIndex() {
    const eventElements = document.querySelectorAll('.timeline-event');
    let minDistance = Infinity;
    let centeredIndex = 0;
    const screenCenter = window.innerHeight / 2;
    
    eventElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      const distance = Math.abs(cardCenter - screenCenter);
      if (distance < minDistance) {
        minDistance = distance;
        centeredIndex = index;
      }
    });
    
    return centeredIndex;
  }

  // Stop voice narration
  function stopVoice() {
    audioNarration.pause();
    isVoicePlaying = false;
    
    panelLanguages.forEach((lang, panelIndex) => {
      const panel = document.querySelectorAll('.panel')[panelIndex];
      if (panel) {
        panel.querySelectorAll('.voice-text').forEach(el => {
          el.textContent = translations[lang].voicePlay;
        });
      }
    });
    
    currentPlaybackQueue = [];
    resetInactivity();
  }

  // Start voice narration in the active context
  function startVoice() {
    isVoicePlaying = true;
    
    const panelIndex = getCurrentPanelIndex();
    const panel = document.querySelectorAll('.panel')[panelIndex];
    if (panel) {
      const lang = panelLanguages[panelIndex];
      panel.querySelectorAll('.voice-text').forEach(el => {
        el.textContent = translations[lang].voiceStop;
      });
    }
    
    playActiveContextVoice();
  }

  // Plays a single TTS narration
  async function playSingleTTS(panelIndex, text, fileName, onEndedCallback) {
    const targetSrc = `../assets/cards/card1/${fileName}`;
    if (isVoicePlaying && audioNarration.src.includes(fileName) && !audioNarration.paused) {
      return;
    }

    const panel = document.querySelectorAll('.panel')[panelIndex];
    const lang = panelLanguages[panelIndex];
    const t = translations[lang];

    try {
      if (panel) {
        panel.querySelectorAll('.btn-voice').forEach(btn => {
          btn.style.pointerEvents = 'none';
          btn.style.opacity = '0.7';
        });
        panel.querySelectorAll('.voice-text').forEach(el => {
          el.textContent = t.loading;
        });
      }

      const outputPath = path.join(__dirname, '..', 'assets', 'cards', 'card1', fileName);
      
      await ipcRenderer.invoke('generate-tts', {
        text: text,
        lang: lang,
        outputPath: outputPath,
        priority: true
      });
      
      if (!isVoicePlaying) return;
      
      audioNarration.src = `${targetSrc}?t=` + Date.now();
      await audioNarration.play();
      
      if (panel) {
        panel.querySelectorAll('.voice-text').forEach(el => {
          el.textContent = t.voiceStop;
        });
      }
      stopAutoScroll();
      
      audioNarration.onended = () => {
        if (panel) {
          panel.querySelectorAll('.btn-voice').forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
          });
        }
        if (onEndedCallback) {
          onEndedCallback();
        } else {
          stopVoice();
        }
      };
      
    } catch (err) {
      console.error("TTS Generation Error:", err);
      if (panel) {
        panel.querySelectorAll('.voice-text').forEach(el => {
          el.textContent = 'Error';
        });
      }
      isVoicePlaying = false;
      resetInactivity();
    } finally {
      if (panel) {
        panel.querySelectorAll('.btn-voice').forEach(btn => {
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
        });
      }
    }
  }

  // Determine active context and trigger play
  async function playActiveContextVoice() {
    if (!isVoicePlaying) return;

    const panelIndex = getCurrentPanelIndex();
    const lang = panelLanguages[panelIndex];
    
    if (panelIndex === 0) {
      // Hero Panel - Intro Text
      const text = lang === 'en' 
        ? window.uprisingData.description.join(' ')
        : window.uprisingData.description_ta.join(' ');
      await playSingleTTS(panelIndex, text, `intro_${lang}.wav`);
      
    } else if (panelIndex === 1) {
      // Timeline Panel - Events
      const centeredIdx = getCenteredTimelineCardIndex();
      const events = window.uprisingData.features.timeline.events;
      const eventsTa = window.uprisingData.features.timeline.events_ta || events;
      const eventElements = document.querySelectorAll('.timeline-event');
      
      if (centeredIdx < events.length) {
        const ev = events[centeredIdx];
        const evTa = eventsTa[centeredIdx];
        const text = lang === 'en' ? ev.description : evTa.description;
        
        currentPlaybackIndex = centeredIdx;
        
        // Auto scroll to center the active card
        const element = eventElements[centeredIdx];
        if (element) {
          const topPos = element.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
            top: topPos - (window.innerHeight / 2) + (element.offsetHeight / 2),
            behavior: 'smooth'
          });
        }
        
        await playSingleTTS(panelIndex, text, `timeline_${centeredIdx}_${lang}.wav`, () => {
          if (isVoicePlaying && getCurrentPanelIndex() === 1) {
            const nextIdx = currentPlaybackIndex + 1;
            if (nextIdx < events.length) {
              const nextEl = eventElements[nextIdx];
              if (nextEl) {
                const topPos = nextEl.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                  top: topPos - (window.innerHeight / 2) + (nextEl.offsetHeight / 2),
                  behavior: 'smooth'
                });
                setTimeout(() => {
                   if (isVoicePlaying) playActiveContextVoice();
                }, 800);
              }
            } else {
              stopVoice();
              if (localStorage.getItem('kiosk_global_auto') === 'true') {
                 // Sequence to Map
                 window.scrollTo({ top: document.querySelectorAll('.panel')[2].offsetTop, behavior: 'smooth' });
                 setTimeout(() => playActiveContextVoice(), 1000);
              }
            }
          }
        });
      }
      
    } else if (panelIndex === 2) {
      // Map Panel
      if (activeLocation) {
        const loc = activeLocation;
        const pointsList = lang === 'ta' ? loc.points_ta : loc.points;
        const nameText = lang === 'ta' ? loc.name_ta : loc.name;
        const text = `${nameText}. ${pointsList.join('. ')}`;
        await playSingleTTS(panelIndex, text, `map_loc_${loc.id}_${lang}.wav`);
      } else {
        const text = lang === 'en'
          ? "Map Trace of the Sepoy Mutiny 1857. Tap the red pulsing dots on the map to explore key historical events."
          : "1857 சிப்பாய் கலகத்தின் வரைபடப் பாதை. வரைபடத்தில் உள்ள சிவப்பு நிற துடிக்கும் புள்ளிகளைத் தட்டி முக்கிய வரலாற்று நிகழ்வுகளை ஆராயுங்கள்.";
        await playSingleTTS(panelIndex, text, `map_${lang}.wav`);
      }
      
    } else if (panelIndex === 3) {
      // Rifle Panel
      const rifle = window.uprisingData.features.rifle;
      let text = "";
      if (lang === 'en') {
        text = `${rifle.title} Calibre: ${rifle.details.Calibre}. Loading Mechanism: ${rifle.details.LoadingMechanism}. Lock Type: ${rifle.details.LockType}. Origin: ${rifle.details.Origin}. Ammunition: ${rifle.details.Ammunition}`;
      } else {
        text = `${rifle.title_ta} கலிபர்: ${rifle.details_ta["கலிபர்"]}. ஏற்றும் முறை: ${rifle.details_ta["ஏற்றும் முறை"]}. விசை வகை: ${rifle.details_ta["விசை வகை"]}. தயாரிப்பு: ${rifle.details_ta["தயாரிப்பு"]}. வெடிமருந்து: ${rifle.details_ta["வெடிமருந்து"]}`;
      }
      await playSingleTTS(panelIndex, text, `rifle_${lang}.wav`);
    }
  }

  // Audio Voice Button Toggle Action
  function handleVoiceToggle() {
    if (isVoicePlaying) {
      stopVoice();
    } else {
      startVoice();
    }
  }

  // Weapon details image slideshow
  const weaponSlideshow = document.getElementById('weapon-slideshow');
  let currentWeaponImgIdx = 0;
  let slideshowInterval = null;

  function initWeaponSlideshow() {
    if (!weaponSlideshow) return;
    
    // Clear and rebuild to show the correct language diagram
    weaponSlideshow.innerHTML = '';
    
    const lang = panelLanguages[3];
    const detailImgSrc = lang === 'ta' ? 'assets/Image/weapon/Detail_Tamil.png' : 'assets/Image/weapon/Detail.png';
    const weaponImages = [
      detailImgSrc,
      'assets/Image/weapon/sepoy_image.png'
    ];
    
    weaponImages.forEach((src, idx) => {
      const img = document.createElement('img');
      img.src = src;
      if (idx === currentWeaponImgIdx % weaponImages.length) {
        img.classList.add('active');
      }
      weaponSlideshow.appendChild(img);
    });

    if (!slideshowInterval) {
      slideshowInterval = setInterval(() => {
        const imgs = weaponSlideshow.querySelectorAll('img');
        if (imgs.length > 0) {
          imgs[currentWeaponImgIdx].classList.remove('active');
          currentWeaponImgIdx = (currentWeaponImgIdx + 1) % imgs.length;
          imgs[currentWeaponImgIdx].classList.add('active');
        }
      }, 3000);
    }
  }

  // --- Stacking Cards Height Logic ---
  const ro = new ResizeObserver(() => {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
      const panelHeight = panel.offsetHeight;
      const windowHeight = window.innerHeight;
      
      if (panelHeight > windowHeight) {
        panel.style.top = `-${panelHeight - windowHeight}px`;
      } else {
        panel.style.top = '0px';
      }
    });
  });
  ro.observe(document.body);

  // --- Scroll Snapping Arrest Lock Logic ---
  let isScrollLocked = false;
  let lockedScrollY = 0;
  let panelLockState = [true, true, true, true]; // Lock transition out of panels 0, 1, 2, 3

  // Helper to block manual wheel / touch scrolling while locked
  function preventDefault(e) {
    if (isScrollLocked) {
      e.preventDefault();
    }
  }
  window.addEventListener('wheel', preventDefault, { passive: false });
  window.addEventListener('touchmove', preventDefault, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (isScrollLocked && ['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('scroll', () => {
    if (isTranslating) return;
    if (isScrollLocked) {
      window.scrollTo(0, lockedScrollY);
      return;
    }

    const currentScrollY = window.scrollY;
    const panels = document.querySelectorAll('.panel');
    
    // Find current panel index
    let currentPanelIndex = 0;
    panels.forEach((panel, index) => {
      if (currentScrollY >= panel.offsetTop - 50) {
        currentPanelIndex = index;
      }
    });

    // If we are at the end of the current panel (and it's not the last panel)
    if (currentPanelIndex < panels.length - 1) {
      const panel = panels[currentPanelIndex];
      const panelEndScrollY = panel.offsetTop + Math.max(0, panel.offsetHeight - window.innerHeight);
      
      // If we scroll down beyond the end of the current panel and it's currently locked
      if (currentScrollY > panelEndScrollY + 15 && panelLockState[currentPanelIndex]) {
        isScrollLocked = true;
        lockedScrollY = panelEndScrollY;
        
        window.scrollTo(0, panelEndScrollY);
        
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
          isScrollLocked = false;
          panelLockState[currentPanelIndex] = false; // Unlock so user can now transition
          
          document.documentElement.style.paddingRight = '';
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
        }, 3000); // 3 seconds pause
        
        return;
      }
    }

    // Reset lock states of other panels if the user scrolls away from their boundary
    panels.forEach((panel, index) => {
      if (index < panels.length - 1) {
        const panelEndScrollY = panel.offsetTop + Math.max(0, panel.offsetHeight - window.innerHeight);
        if (currentScrollY < panelEndScrollY - 100) {
          panelLockState[index] = true;
        }
      }
    });

    // --- Highlight the centered timeline dot ---
    if (currentPanelIndex === 1) { // Timeline panel
      const centeredIdx = getCenteredTimelineCardIndex();
      const eventElements = document.querySelectorAll('.timeline-event');
      eventElements.forEach((el, idx) => {
        if (idx === centeredIdx) {
          el.classList.add('centered-event');
        } else {
          el.classList.remove('centered-event');
        }
      });
    }

    // Check if we need to sync voice playback
    if (isVoicePlaying) {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        playActiveContextVoice();
      }, 300);
    }
  });

  // Hide loader spinner once content is initialized
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.opacity = '0';
    setTimeout(() => {
      loading.style.display = 'none';
    }, 500);
  }

  // --- Auto Scroll on Inactivity ---
  let isAutoScrolling = false;
  let isAutoScrollingUp = false;
  let autoScrollInterval = null;
  let autoScrollUpInterval = null;
  let autoScrollTimer = null;
  let scrollUpPauseTimer = null;
  const INACTIVITY_DELAY = 60000; // 1 minute

  function resetModelViewer() {
    // Reset 3D Model orientation and camera zoom
    const mv = document.querySelector('model-viewer');
    if (mv) {
      mv.cameraOrbit = 'unset';
      mv.cameraTarget = 'unset';
      mv.fieldOfView = 'unset';
      mv.jumpCameraToGoal();
    }
    // Close map event info popup
    const mapInfo = document.getElementById('map-info');
    if (mapInfo) {
      mapInfo.classList.add('hidden');
    }
    activeLocation = null;
  }

  function startAutoScroll() {
    if (isAutoScrolling || isVoicePlaying) return;
    
    // If we are already at the bottom, start scrolling back up
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10) {
      startAutoScrollUp();
      return;
    }

    isAutoScrolling = true;
    document.documentElement.classList.add('no-snap');

    autoScrollInterval = setInterval(() => {
      window.scrollBy(0, 1);
      
      const currentY = window.scrollY;
      const isAtBottom = (window.innerHeight + currentY) >= document.documentElement.scrollHeight - 5;
      
      if (isAtBottom) {
        stopAutoScroll();
        scrollUpPauseTimer = setTimeout(() => {
          startAutoScrollUp();
        }, 1500);
      }
    }, 25); // Scrolls ~40px per second, smooth and readable
  }

  function startAutoScrollUp() {
    if (isAutoScrollingUp) return;
    isAutoScrollingUp = true;
    document.documentElement.classList.add('no-snap');

    autoScrollUpInterval = setInterval(() => {
      window.scrollBy(0, -3); // 3X the downward speed
      
      const currentY = window.scrollY;
      if (currentY <= 0) {
        stopAutoScrollUp();
        resetModelViewer(); // close any open popups
        // Loop: immediately start scrolling down again
        setTimeout(() => {
          if (!isVoicePlaying) startAutoScroll();
        }, 800); // brief pause at top before looping down
      }
    }, 25);
  }

  function stopAutoScroll() {
    if (!isAutoScrolling) return;
    isAutoScrolling = false;
    document.documentElement.classList.remove('no-snap');
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  function stopAutoScrollUp() {
    if (!isAutoScrollingUp) return;
    isAutoScrollingUp = false;
    document.documentElement.classList.remove('no-snap');
    if (autoScrollUpInterval) {
      clearInterval(autoScrollUpInterval);
      autoScrollUpInterval = null;
    }
  }

  function resetInactivity() {
    stopAutoScroll();
    stopAutoScrollUp();
    clearTimeout(scrollUpPauseTimer);
    clearTimeout(autoScrollTimer);
    autoScrollTimer = setTimeout(startAutoScroll, INACTIVITY_DELAY);
  }

  // User manual interaction listeners to reset the inactivity timer
  window.addEventListener('wheel', resetInactivity, { passive: true });
  window.addEventListener('touchmove', resetInactivity, { passive: true });
  window.addEventListener('mousedown', resetInactivity, { passive: true });
  window.addEventListener('keydown', resetInactivity, { passive: true });
  
  window.addEventListener('scroll', () => {
    if (!isAutoScrolling && !isAutoScrollingUp) {
      resetInactivity();
    }
  });

  // Start the initial inactivity timer on load
  autoScrollTimer = setTimeout(startAutoScroll, INACTIVITY_DELAY);

  // Set up event delegation for localized language toggle and voice controls
  document.addEventListener('click', (e) => {
    const btnLangClicked = e.target.closest('.btn-lang');
    const btnVoiceClicked = e.target.closest('.btn-voice');
    
    if (btnLangClicked) {
      const panel = btnLangClicked.closest('.panel');
      const panels = Array.from(document.querySelectorAll('.panel'));
      const panelIndex = panels.indexOf(panel);
      handleLangChange(panelIndex);
    } else if (btnVoiceClicked) {
      handleVoiceToggle();
    }
  });

  window.addEventListener('kiosk_auto_cancelled', () => {
     if (isVoicePlaying) {
        stopVoice();
     }
  });

  // Initial Content Population
  renderContent();
  
  // Global Auto Kiosk Logic
  if (localStorage.getItem('kiosk_global_auto') === 'true') {
      setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
          setTimeout(() => {
              isVoicePlaying = true;
              playActiveContextVoice();
              
              // We need to override stopVoice to intercept the end of panels
              const originalStopVoice = stopVoice;
              stopVoice = function() {
                  originalStopVoice();
                  if (localStorage.getItem('kiosk_global_auto') !== 'true') return;
                  
                  const idx = getCurrentPanelIndex();
                  const panels = document.querySelectorAll('.panel');
                  if (idx === 0) {
                      window.scrollTo({ top: panels[1].offsetTop, behavior: 'smooth' });
                      setTimeout(() => { isVoicePlaying = true; playActiveContextVoice(); }, 1500);
                  } else if (idx === 2) {
                      window.scrollTo({ top: panels[3].offsetTop, behavior: 'smooth' });
                      setTimeout(() => { isVoicePlaying = true; playActiveContextVoice(); }, 1500);
                  } else if (idx === 3) {
                      window.location.href = '../index.html';
                  }
              };
          }, 1000);
      }, 500);
  }
});

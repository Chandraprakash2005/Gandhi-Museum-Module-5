document.addEventListener('DOMContentLoaded', () => {
  let currentLang = localStorage.getItem('kiosk_global_lang') || 'ta';
  let isVideoPlaying = false;

  if (typeof card3Data === 'undefined') {
    console.error("Data not loaded!");
    return;
  }

  // DOM Elements
  const btnLang = document.getElementById('btn-lang');
  const sidebar = document.getElementById('sidebar');
  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  
  const navVideo = document.getElementById('btn-nav-video');
  const navTimeline = document.getElementById('btn-nav-timeline');
  const navAssociates = document.getElementById('btn-nav-associates');
  
  const secVideo = document.getElementById('section-video');
  const secTimeline = document.getElementById('section-timeline');
  const secAssociates = document.getElementById('section-associates');

  const videoOverlay = document.getElementById('video-overlay');
  const btnPlayVideo = document.getElementById('btn-play-video');
  const ttsAudio = document.getElementById('tts-audio');

  const timelineContainer = document.getElementById('timeline-container');
  const timelineTitle = document.getElementById('timeline-title');
  const associatesContainer = document.getElementById('associates-container');
  const associatesTitle = document.getElementById('associates-title');

  // Electron IPC
  let ipcRenderer = null;
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    console.log('Not running in Electron.');
  }
  const path = require('path');

  let currentSection = 'section-video';
  const btnVoice = document.getElementById('btn-voice');
  const voiceText = document.getElementById('voice-text');
  let isVoicePlaying = false;
  let voicePlayCounter = 0;

  function stopVoice() {
    ttsAudio.pause();
    isVoicePlaying = false;
    if (voiceText) voiceText.textContent = currentLang === 'ta' ? 'குரல்' : 'Voice';
  }

  function getSectionText(lang, sectionId) {
    if (sectionId === 'section-video') {
      return card3Data.intro[lang].sections.map(s => s.text).join(' ');
    } else if (sectionId === 'section-timeline') {
      const events = card3Data.timeline[lang].events;
      return card3Data.timeline[lang].title + '. ' + events.map(e => `${e.year}. ${e.title}. ${e.desc}`).join(' ');
    } else if (sectionId === 'section-associates') {
      const title = lang === 'ta' ? 'கூட்டாளிகள்' : 'Associates';
      const persons = card3Data.associates.map(p => {
        const d = p[lang];
        return `${d.name}, ${d.years}. ${d.desc}`;
      }).join(' ');
      return title + '. ' + persons;
    }
    return '';
  }

  async function playVoice(lang, sectionId, overrideText = null, onPlayStart = null, onPlayEnd = null) {
    if (isVoicePlaying) {
      stopVoice();
      if (!overrideText) return; 
    }
    
    const textToSpeak = overrideText || getSectionText(lang, sectionId);
    if (!textToSpeak) {
      if (onPlayStart) onPlayStart();
      return;
    }

    if (voiceText) voiceText.textContent = lang === 'ta' ? 'நிறுத்து' : 'Stop';
    isVoicePlaying = true;
    voicePlayCounter++;
    const currentPlayId = voicePlayCounter;
    
    if (ipcRenderer) {
      // Use hash of text to prevent caching issues, especially since regex strips Tamil chars
      const hash = btoa(encodeURIComponent(textToSpeak)).substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
      const audioFileName = `card3_voice_${sectionId}_${hash}_${lang}.wav`;
      const outputPath = path.join(__dirname, '..', 'assets', 'cards', 'card3', audioFileName);
      
      const fs = require('fs');
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      try {
        await ipcRenderer.invoke('generate-tts', {
          text: textToSpeak,
          lang: lang,
          outputPath: outputPath,
          priority: true
        });
        
        if (currentPlayId !== voicePlayCounter || !isVoicePlaying) return;
        
        ttsAudio.src = `../assets/cards/card3/${audioFileName}?t=` + Date.now();
        ttsAudio.play().then(() => {
          if (onPlayStart) onPlayStart();
        }).catch(err => {
          console.error("Audio play failed", err);
          if (onPlayStart) onPlayStart();
        });
        ttsAudio.onended = () => {
          stopVoice();
          if (onPlayEnd) onPlayEnd();
        };
      } catch (e) {
        console.error("TTS generation failed", e);
        stopVoice();
        if (onPlayStart) onPlayStart();
      }
    } else {
      if (onPlayStart) onPlayStart();
    }
  }

  if (btnVoice) {
    btnVoice.addEventListener('click', () => {
      if (isVoicePlaying) {
        stopVoice();
      } else {
        if (currentSection === 'section-associates') {
             const activeDot = document.querySelector('.assoc-dot-item.active');
             if (activeDot) activeDot.click();
        } else if (currentSection === 'section-timeline') {
             const activeDot = document.querySelector('.timeline-dot-item:not(.assoc-dot-item).active');
             if (activeDot) activeDot.click();
        } else {
             playVoice(currentLang, currentSection);
        }
      }
    });
  }

  let isAutoPlayActive = false;

  // Hook into global auto play
  if (localStorage.getItem('kiosk_global_auto') === 'true') {
    isAutoPlayActive = true;
    setTimeout(() => {
        if (currentSection !== 'section-video') {
           navVideo.click();
           setTimeout(() => btnPlayVideo.click(), 500);
        } else if (!isVideoPlaying) {
           btnPlayVideo.click();
        }
    }, 1000);
  }
  
  window.addEventListener('kiosk_auto_cancelled', () => {
      isAutoPlayActive = false;
      if (isVoicePlaying) stopVoice();
      stopSlideshow();
  });

  let currentVideoSectionIndex = 0;
  let currentVideoImageIndex = 0;
  let videoImageInterval = null;
  let currentTimelineIndex = 0;
  let currentAssocIndex = 0;

  function playNextVideoSection(lang) {
     if (currentSection !== 'section-video') return;
     const sections = card3Data.intro[lang].sections;
     
     if (currentVideoSectionIndex < sections.length) {
         const sec = sections[currentVideoSectionIndex];
         
         const overlay = document.getElementById('slideshow-text-overlay');
         const heading = document.getElementById('slideshow-heading');
         const textEl = document.getElementById('slideshow-text');
         overlay.classList.remove('hidden');
         heading.textContent = sec.heading;
         textEl.textContent = sec.text;

         const slideshowContainer = document.getElementById('slideshow-container');
         slideshowContainer.innerHTML = '';
         sec.images.forEach((imgSrc, idx) => {
            const imgEl = document.createElement('img');
            imgEl.src = imgSrc;
            imgEl.className = 'slideshow-frame';
            if (idx === 0) imgEl.classList.add('active');
            slideshowContainer.appendChild(imgEl);
         });
         
         clearInterval(videoImageInterval);
         currentVideoImageIndex = 0;
         if (sec.images.length > 1) {
             videoImageInterval = setInterval(() => {
                const imgs = slideshowContainer.querySelectorAll('.slideshow-frame');
                if (imgs.length > 0) {
                   imgs[currentVideoImageIndex].classList.remove('active');
                   currentVideoImageIndex = (currentVideoImageIndex + 1) % imgs.length;
                   imgs[currentVideoImageIndex].classList.add('active');
                }
             }, 3500);
         }

         playVoice(lang, `section-video-${currentVideoSectionIndex}`, sec.text, null, () => {
             currentVideoSectionIndex++;
             playNextVideoSection(lang);
         });
     } else {
         const finalText = card3Data.intro[lang].finalText;
         if (finalText) {
             const overlay = document.getElementById('slideshow-text-overlay');
             const heading = document.getElementById('slideshow-heading');
             const textEl = document.getElementById('slideshow-text');
             heading.textContent = card3Data.intro[lang].title;
             textEl.textContent = finalText;
             
             clearInterval(videoImageInterval);
             
             playVoice(lang, 'section-video-final', finalText, null, () => {
                 if (isAutoPlayActive) {
                    navTimeline.click();
                 }
                 currentVideoSectionIndex = 0; // Reset
             });
         } else {
             if (isAutoPlayActive) {
                navTimeline.click();
             }
             currentVideoSectionIndex = 0; // Reset
         }
     }
  }

  function stopSlideshow() {
    clearInterval(videoImageInterval);
    const overlay = document.getElementById('slideshow-text-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  btnPlayVideo.addEventListener('click', () => {
    videoOverlay.classList.add('hidden');
    isVideoPlaying = true;
    currentVideoSectionIndex = 0;
    playNextVideoSection(currentLang);
    
    // Hide sidebar and show toggle arrow
    sidebar.classList.add('hidden');
    if (btnSidebarToggle) btnSidebarToggle.classList.add('visible');
  });

  if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', () => {
      sidebar.classList.remove('hidden');
      btnSidebarToggle.classList.remove('visible');
    });
  }


  // Navigation Logic
  function switchSection(btn, sec) {
    // Hide all
    [navVideo, navTimeline, navAssociates].forEach(b => b.classList.remove('active'));
    [secVideo, secTimeline, secAssociates].forEach(s => s.classList.remove('active'));
    
    // Show selected
    btn.classList.add('active');
    sec.classList.add('active');
    currentSection = sec.id;
    
    // Ensure sidebar is visible
    sidebar.classList.remove('hidden');
    if (btnSidebarToggle) btnSidebarToggle.classList.remove('visible');
    
    // Toggle voice button visibility
    if (btnVoice) {
      btnVoice.style.display = (sec.id === 'section-video') ? 'none' : 'flex';
    }

    // Pause video if navigating away
    if (sec !== secVideo) {
      stopSlideshow();
      videoOverlay.classList.remove('hidden');
      isVideoPlaying = false;
    }
    stopVoice();
    
    // Auto-play voice for Timeline and Associates
    if (sec === secTimeline) {
      currentTimelineIndex = 0;
      setTimeout(() => {
        const events = card3Data.timeline[currentLang].events;
        if (events.length > 0) {
          playVoice(currentLang, 'section-timeline', `${events[0].year}. ${events[0].title}. ${events[0].desc}`, null, () => {
             const dots = document.querySelectorAll('.timeline-dot-item:not(.assoc-dot-item)');
             const activeIndex = Array.from(dots).findIndex(d => d.classList.contains('active'));
             if (activeIndex >= 0 && activeIndex < dots.length - 1) {
                 dots[activeIndex + 1].click();
             } else {
                 navAssociates.click();
             }
          });
        }
      }, 500);
    } else if (sec === secAssociates) {
      setTimeout(() => {
        const assoc = card3Data.associates;
        if (assoc.length > 0) {
          const first = assoc[0][currentLang];
          playVoice(currentLang, 'section-associates', `${first.name}, ${first.years}. ${first.desc}`, null, () => {
             const dots = document.querySelectorAll('.assoc-dot-item');
             if (dots.length > 1) {
                 dots[1].click();
             } else {
                 isAutoPlayActive = false;
                 if (localStorage.getItem('kiosk_global_auto') === 'true') {
                     window.location.href = '../index.html';
                 }
             }
          });
        }
      }, 500);
    }
  }

  navVideo.addEventListener('click', () => switchSection(navVideo, secVideo));
  navTimeline.addEventListener('click', () => switchSection(navTimeline, secTimeline));
  navAssociates.addEventListener('click', () => switchSection(navAssociates, secAssociates));

  // Render Content
  function renderContent(lang) {
    // 1. Timeline (Horizontal)
    timelineTitle.textContent = card3Data.timeline[lang].title;
    timelineContainer.innerHTML = '';
    
    const topCard = document.createElement('div');
    topCard.className = 'timeline-top-card';
    topCard.innerHTML = `
      <div class="timeline-title-wrapper">
        <div class="timeline-date" id="active-timeline-date"></div>
        <h3 class="timeline-title" id="active-timeline-title"></h3>
      </div>
      <p class="timeline-desc" id="active-timeline-desc"></p>
    `;
    timelineContainer.appendChild(topCard);

    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'timeline-track-wrapper';
    
    const trackLine = document.createElement('div');
    trackLine.className = 'timeline-track-line';
    trackWrapper.appendChild(trackLine);

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'timeline-dots-container';
    
    const events = card3Data.timeline[lang].events;
    events.forEach((event, index) => {
      const dotItem = document.createElement('div');
      dotItem.className = 'timeline-dot-item';
      if (index === currentTimelineIndex) dotItem.classList.add('active');
      
      dotItem.innerHTML = `
        <div class="dot-circle"></div>
        <div class="dot-label">
          <div class="dot-year">${event.year}</div>
        </div>
      `;
      dotItem.addEventListener('click', (e) => {
        currentTimelineIndex = index;
        if (e && e.isTrusted) {
          // Start auto-advancing from this click
          isAutoPlayActive = true; 
        }
        
        document.querySelectorAll('.timeline-dot-item').forEach(el => el.classList.remove('active'));
        dotItem.classList.add('active');
        
        topCard.classList.remove('visible');
        
        setTimeout(() => {
          document.getElementById('active-timeline-date').textContent = event.year;
          document.getElementById('active-timeline-title').textContent = event.title;
          document.getElementById('active-timeline-desc').textContent = event.desc;
          
          const bgLayer = document.getElementById('timeline-bg');
          if (bgLayer && event.bgImage) {
            bgLayer.style.backgroundImage = `url('${event.bgImage}')`;
          }
          if (event.bgImage) {
            topCard.style.backgroundImage = `linear-gradient(rgba(216,189,161,0.85), rgba(216,189,161,0.85)), url('${event.bgImage}')`;
          }
          
          topCard.classList.add('visible');
          
          stopVoice();
          playVoice(lang, 'section-timeline', `${event.year}. ${event.title}. ${event.desc}`, null, () => {
              const dots = document.querySelectorAll('.timeline-dot-item:not(.assoc-dot-item)');
              const activeIndex = Array.from(dots).findIndex(d => d.classList.contains('active'));
              if (activeIndex >= 0 && activeIndex < dots.length - 1) {
                  dots[activeIndex + 1].click();
              } else {
                  if (isAutoPlayActive) {
                      navAssociates.click();
                  }
              }
          });
        }, 300);
      });
      
      dotsContainer.appendChild(dotItem);
    });
    
    trackWrapper.appendChild(dotsContainer);
    timelineContainer.appendChild(trackWrapper);

    // Initialize top card with first event
    if (events.length > 0) {
      const activeEv = events[currentTimelineIndex] || events[0];
      document.getElementById('active-timeline-date').textContent = activeEv.year;
      document.getElementById('active-timeline-title').textContent = activeEv.title;
      document.getElementById('active-timeline-desc').textContent = activeEv.desc;
      
      const bgLayer = document.getElementById('timeline-bg');
      if (bgLayer && activeEv.bgImage) {
        bgLayer.style.backgroundImage = `url('${activeEv.bgImage}')`;
      }
      if (activeEv.bgImage) {
        topCard.style.backgroundImage = `linear-gradient(rgba(216,189,161,0.85), rgba(216,189,161,0.85)), url('${activeEv.bgImage}')`;
      }
      
      setTimeout(() => {
        topCard.classList.add('visible');
      }, 100);
    }

    // 2. Associates
    associatesTitle.textContent = lang === 'ta' ? 'கூட்டாளிகள்' : 'Associates';
    associatesContainer.innerHTML = '';
    
    // Create Top Card for Associates
    const topAssocCard = document.createElement('div');
    topAssocCard.className = 'timeline-top-card'; // Reuse styling
    topAssocCard.innerHTML = `
      <div class="timeline-title-wrapper">
        <h3 class="timeline-title" id="active-assoc-name"></h3>
        <div class="timeline-date" id="active-assoc-years"></div>
      </div>
      <p class="timeline-desc" id="active-assoc-desc"></p>
    `;
    associatesContainer.appendChild(topAssocCard);

    // Create Bottom Track for Associates
    const assocTrackWrapper = document.createElement('div');
    assocTrackWrapper.className = 'timeline-track-wrapper assoc-track-wrapper';
    
    const assocTrackLine = document.createElement('div');
    assocTrackLine.className = 'timeline-track-line';
    assocTrackWrapper.appendChild(assocTrackLine);

    const assocDotsContainer = document.createElement('div');
    assocDotsContainer.className = 'timeline-dots-container assoc-dots-container';

    card3Data.associates.forEach((person, index) => {
      const data = person[lang];
      const dotItem = document.createElement('div');
      dotItem.className = 'timeline-dot-item assoc-dot-item';
      if (index === currentAssocIndex) dotItem.classList.add('active');
      
      dotItem.innerHTML = `
        <img src="${person.image}" class="assoc-thumbnail" alt="${data.name}">
        <div class="dot-label">
          <div class="dot-title">${data.name}</div>
        </div>
      `;
      
      dotItem.addEventListener('click', (e) => {
        currentAssocIndex = index;
        if (e && e.isTrusted) {
          isAutoPlayActive = true;
        }
        
        document.querySelectorAll('.assoc-dot-item').forEach(el => el.classList.remove('active'));
        dotItem.classList.add('active');
        
        topAssocCard.classList.remove('visible');
        
        setTimeout(() => {
          document.getElementById('active-assoc-name').textContent = data.name;
          document.getElementById('active-assoc-years').textContent = data.years;
          document.getElementById('active-assoc-desc').textContent = data.desc;
          if (person.image) {
            topAssocCard.style.backgroundImage = `linear-gradient(rgba(216,189,161,0.85), rgba(216,189,161,0.85)), url('${person.image}')`;
          }
          topAssocCard.classList.add('visible');
          
          stopVoice();
          playVoice(lang, 'section-associates', `${data.name}, ${data.years}. ${data.desc}`, null, () => {
              const dots = document.querySelectorAll('.assoc-dot-item');
              const activeIndex = Array.from(dots).findIndex(d => d.classList.contains('active'));
              if (activeIndex >= 0 && activeIndex < dots.length - 1) {
                  dots[activeIndex + 1].click();
              } else {
                  isAutoPlayActive = false;
                  
                  // Return to main menu if global auto is on
                  if (localStorage.getItem('kiosk_global_auto') === 'true') {
                     window.location.href = '../index.html';
                  }
              }
          });
        }, 300);
      });
      
      assocDotsContainer.appendChild(dotItem);
    });
    
    assocTrackWrapper.appendChild(assocDotsContainer);
    associatesContainer.appendChild(assocTrackWrapper);

    // Initialize top card with first associate
    if (card3Data.associates.length > 0) {
      const activeAssoc = card3Data.associates[currentAssocIndex] || card3Data.associates[0];
      const data = activeAssoc[lang];
      document.getElementById('active-assoc-name').textContent = data.name;
      document.getElementById('active-assoc-years').textContent = data.years;
      document.getElementById('active-assoc-desc').textContent = data.desc;
      if (activeAssoc.image) {
        topAssocCard.style.backgroundImage = `linear-gradient(rgba(216,189,161,0.85), rgba(216,189,161,0.85)), url('${activeAssoc.image}')`;
      }
      setTimeout(() => {
        topAssocCard.classList.add('visible');
      }, 100);
    }

    // Sidebar labels
    navVideo.textContent = lang === 'ta' ? 'அறிமுக காணொளி' : 'Intro Video';
    navTimeline.textContent = lang === 'ta' ? 'காலக்கோடு' : 'Timeline';
    navAssociates.textContent = lang === 'ta' ? 'கூட்டாளிகள்' : 'Associates';
    document.getElementById('play-text').textContent = lang === 'ta' ? 'இயக்க கிளிக் செய்க' : 'Click to Play';

    const btnBack = document.querySelector('.sidebar-back');
    if (btnBack) {
      btnBack.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> ${lang === 'ta' ? 'பின்செல்' : 'Back'}`;
    }
  }

  // Language Toggle
  btnLang.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'ta' : 'en';
    btnLang.textContent = currentLang === 'en' ? 'ENG' : 'தமிழ்';
    document.body.className = `lang-${currentLang}`;
    
    renderContent(currentLang);
    updateSectionBackgrounds(currentLang);
    
    // Restart video or voice on language change
    if (currentSection === 'section-video' && isVideoPlaying) {
       stopVoice();
       currentVideoSectionIndex = 0;
       playNextVideoSection(currentLang);
    } else if (isVoicePlaying) {
      stopVoice();
      if (currentSection === 'section-timeline') {
         const dots = document.querySelectorAll('.timeline-dot-item:not(.assoc-dot-item)');
         if (dots[currentTimelineIndex]) dots[currentTimelineIndex].click();
      } else if (currentSection === 'section-associates') {
         const dots = document.querySelectorAll('.assoc-dot-item');
         if (dots[currentAssocIndex]) dots[currentAssocIndex].click();
      }
    }
  });

  function updateSectionBackgrounds(lang) {
    const timelineSec = document.getElementById('section-timeline');
    const assocSec = document.getElementById('section-associates');
    const langSuffix = lang === 'en' ? 'english' : 'tamil';
    
    if (timelineSec) {
      timelineSec.style.backgroundImage = `url('assets/background/card3_bg.png')`;
    }
    if (assocSec) {
      assocSec.style.backgroundImage = `url('assets/background/card3_associates_bg-${langSuffix}.png')`;
    }
  }

  // Initial Render
  renderContent(currentLang);
  updateSectionBackgrounds(currentLang);
});

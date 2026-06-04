document.addEventListener('DOMContentLoaded', () => {
  const btnLang = document.getElementById('btn-lang');
  const btnAuto = document.getElementById('btn-auto-kiosk');
  
  let currentLang = localStorage.getItem('kiosk_global_lang') || 'ta';
  
  const translations = {
    en: {
      title: "A Nation Ignites",
      subtitle: "Explore the pivotal moments in India's struggle for independence.",
      m1_badge: "MODULE 01",
      m1_title: "The Uprising of 1857",
      m1_desc: "A torrential, simmering lava of accumulated wrongs and suppressed fury. Discover the sparks of the first war of independence.",
      m2_badge: "MODULE 02",
      m2_title: "Voices of Renaissance",
      m2_desc: "Explore the intellectual and spiritual awakening that paved the way for freedom. Meet the thinkers who ignited a nation's consciousness.",
      m3_badge: "MODULE 03",
      m3_title: "Gandhi Era Begins (1915 - 1920)",
      m3_desc: "The dawn of non-violent resistance. Witness how truth and courage became the ultimate weapons in the fight against colonial rule.",
      btn_explore: "Explore Module",
      btn_auto: "Automatic",
      btn_stop_auto: "Stop Auto"
    },
    ta: {
      title: "ஒரு தேசம் விழித்தெழுகிறது",
      subtitle: "இந்திய சுதந்திரப் போராட்டத்தின் முக்கிய தருணங்களை ஆராயுங்கள்.",
      m1_badge: "தொகுதி 01",
      m1_title: "1857 பெருங்கலகம்",
      m1_desc: "ஒடுக்கப்பட்ட கோபமும், குவிந்த அநீதிகளும் எரிமலையாய் வெடித்தன. முதல் சுதந்திரப் போரின் நெருப்புப் பொறிகளை கண்டறியுங்கள்.",
      m2_badge: "தொகுதி 02",
      m2_title: "மறுமலர்ச்சியின் குரல்கள்",
      m2_desc: "சுதந்திரத்திற்கு வழிவகுத்த அறிவுசார் மற்றும் ஆன்மீக விழிப்புணர்வை ஆராயுங்கள். தேசத்தின் உணர்வை தூண்டிய சிந்தனையாளர்களை சந்தியுங்கள்.",
      m3_badge: "தொகுதி 03",
      m3_title: "காந்தியுகம் தொடங்குகிறது (1915 - 1920)",
      m3_desc: "அறவழிப் போராட்டத்தின் விடியல். காலனித்துவ ஆட்சிக்கு எதிரான போராட்டத்தில் உண்மையும் துணிச்சலும் எவ்வாறு இறுதி ஆயுதங்களாக மாறின என்பதைக் காணுங்கள்.",
      btn_explore: "தொகுதியை ஆராய்க",
      btn_auto: "தானியங்கி",
      btn_stop_auto: "நிறுத்து"
    }
  };

  function updateMainLanguage() {
      const t = translations[currentLang];
      document.querySelector('h1').textContent = t.title;
      document.getElementById('main-subtitle').textContent = t.subtitle;
      
      const cards = document.querySelectorAll('.card');
      if (cards.length === 3) {
          cards[0].querySelector('.card-badge').textContent = t.m1_badge;
          cards[0].querySelector('h2').textContent = t.m1_title;
          cards[0].querySelector('p').textContent = t.m1_desc;
          
          cards[1].querySelector('.card-badge').textContent = t.m2_badge;
          cards[1].querySelector('h2').textContent = t.m2_title;
          cards[1].querySelector('p').textContent = t.m2_desc;
          
          cards[2].querySelector('.card-badge').textContent = t.m3_badge;
          cards[2].querySelector('h2').textContent = t.m3_title;
          cards[2].querySelector('p').textContent = t.m3_desc;
          
          cards.forEach(c => {
             c.querySelector('.btn').textContent = t.btn_explore;
          });
      }
      
      if (btnLang) {
          btnLang.textContent = currentLang === 'en' ? 'தமிழ்' : 'ENG';
      }
      
      if (btnAuto) {
          const isAuto = localStorage.getItem('kiosk_global_auto') === 'true';
          if (isAuto) {
              btnAuto.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px; margin-top: -3px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> ${t.btn_stop_auto}`;
          } else {
              btnAuto.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px; margin-top: -3px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> ${t.btn_auto}`;
          }
      }
  }

  // Set initial language
  updateMainLanguage();
  
  if (btnLang) {
    btnLang.addEventListener('click', () => {
      currentLang = currentLang === 'en' ? 'ta' : 'en';
      localStorage.setItem('kiosk_global_lang', currentLang);
      updateMainLanguage();
    });
  }

  // Check if we just returned from an auto-play session
  if (btnAuto) {
    if (localStorage.getItem('kiosk_global_auto') === 'true') {
       // A card has finished its sequence and returned here.
       // The user requested we just stay on the main page, so we turn off the global auto flag.
       // The kiosk-idle.js will trigger it again after 3 minutes of inactivity.
       localStorage.setItem('kiosk_global_auto', 'false');
       updateMainLanguage();
    }

    btnAuto.addEventListener('click', () => {
      const isAuto = localStorage.getItem('kiosk_global_auto') === 'true';
      if (isAuto) {
        // Turn off
        localStorage.setItem('kiosk_global_auto', 'false');
        window.location.reload();
      } else {
        // Turn on
        localStorage.setItem('kiosk_global_auto', 'true');
        btnAuto.innerHTML = `Loading...`;
        launchRandomCard();
      }
    });
  }
  
  window.launchRandomCard = function() {
    // Avoid repeating the same card if possible
    const lastCard = localStorage.getItem('kiosk_last_card') || '';
    let cards = ['card1', 'card2', 'card3'];
    if (lastCard && cards.includes(lastCard)) {
       cards = cards.filter(c => c !== lastCard);
    }
    const nextCard = cards[Math.floor(Math.random() * cards.length)];
    localStorage.setItem('kiosk_last_card', nextCard);
    window.location.href = `${nextCard}/index.html`;
  }
});

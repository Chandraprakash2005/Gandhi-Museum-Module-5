const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('log-level', '3');

const rootDir = __dirname;
const piperExe = path.join(rootDir, 'assets', 'Voice model', 'piper', 'piper.exe');
const enModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'en_IN-spicor-medium.onnx');
const taModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'ta_IN-rasa_female-medium.onnx');

// Cleanup function to delete all .wav files in assets/card folders
function cleanupAudio() {
  const cardsParentDir = path.join(rootDir, 'assets', 'cards');
  if (!fs.existsSync(cardsParentDir)) return;
  
  try {
    const subdirs = fs.readdirSync(cardsParentDir);
    subdirs.forEach(subdir => {
      const dirPath = path.join(cardsParentDir, subdir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
          if (file.endsWith('.wav')) {
            try { fs.unlinkSync(path.join(dirPath, file)); } catch (e) {}
          }
        });
      }
    });
  } catch (err) {
    console.error("Audio cleanup error:", err);
  }
}

// Global TTS Queue
let ttsQueue = [];
let isGenerating = false;

function processQueue() {
  if (isGenerating || ttsQueue.length === 0) return;
  isGenerating = true;
  
  const job = ttsQueue.shift();
  
  // Skip if already exists
  if (fs.existsSync(job.outputPath)) {
    isGenerating = false;
    if(job.resolve) job.resolve(job.outputPath);
    return processQueue();
  }

  const model = job.lang === 'ta' ? taModel : enModel;
  console.log(`Generating TTS: ${job.outputPath}`);
  
  // Ensure the output directory exists
  const outDir = path.dirname(job.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const piperProcess = spawn(piperExe, ['-m', model, '-f', job.outputPath]);
  
  piperProcess.stdin.write(job.text);
  piperProcess.stdin.end();
  
  piperProcess.on('close', (code) => {
    isGenerating = false;
    if (code === 0) {
      if(job.resolve) job.resolve(job.outputPath);
    } else {
      console.error(`Piper failed with code ${code} for ${job.outputPath}`);
      if(job.reject) job.reject(new Error(`Piper failed`));
    }
    processQueue();
  });
}

// IPC Handle for frontend requests
ipcMain.handle('generate-tts', async (event, { text, lang, outputPath, priority }) => {
  return new Promise((resolve, reject) => {
    const job = { text, lang, outputPath, resolve, reject };
    if (priority) {
      ttsQueue.unshift(job); // High priority
    } else {
      ttsQueue.push(job); // Background priority
    }
    processQueue();
  });
});

ipcMain.on('log', (event, ...args) => {
  console.log('[RENDERER LOG]', ...args);
});

// Auto-queue all data
function queueAllCards() {
  const c1Dir = path.join(rootDir, 'assets', 'cards', 'card1');
  const c2Dir = path.join(rootDir, 'assets', 'cards', 'card2');
  
  // Card 1
  try {
    const c1Data = require('./card1/data.js');
    if (c1Data && c1Data.description) {
      ttsQueue.push({
        text: c1Data.description.join(' '),
        lang: 'en',
        outputPath: path.join(c1Dir, 'intro_en.wav')
      });
    }
    if (c1Data && c1Data.description_ta) {
      ttsQueue.push({
        text: c1Data.description_ta.join(' '),
        lang: 'ta',
        outputPath: path.join(c1Dir, 'intro_ta.wav')
      });
    }
    if (c1Data && c1Data.features && c1Data.features.timeline) {
      if (c1Data.features.timeline.events) {
        c1Data.features.timeline.events.forEach((ev, i) => {
          ttsQueue.push({ text: ev.description, lang: 'en', outputPath: path.join(c1Dir, `timeline_${i}_en.wav`) });
        });
      }
      if (c1Data.features.timeline.events_ta) {
        c1Data.features.timeline.events_ta.forEach((ev, i) => {
          ttsQueue.push({ text: ev.description, lang: 'ta', outputPath: path.join(c1Dir, `timeline_${i}_ta.wav`) });
        });
      }
    }
    if (c1Data && c1Data.features && c1Data.features.rifle) {
      const rifle = c1Data.features.rifle;
      const textEn = `${rifle.title} Calibre: ${rifle.details.Calibre}. Loading Mechanism: ${rifle.details.LoadingMechanism}. Lock Type: ${rifle.details.LockType}. Origin: ${rifle.details.Origin}. Ammunition: ${rifle.details.Ammunition}`;
      const textTa = `${rifle.title_ta} கலிபர்: ${rifle.details_ta["கலிபர்"]}. ஏற்றும் முறை: ${rifle.details_ta["ஏற்றும் முறை"]}. விசை வகை: ${rifle.details_ta["விசை வகை"]}. தயாரிப்பு: ${rifle.details_ta["தயாரிப்பு"]}. வெடிமருந்து: ${rifle.details_ta["வெடிமருந்து"]}`;
      ttsQueue.push({ text: textEn, lang: 'en', outputPath: path.join(c1Dir, 'rifle_en.wav') });
      ttsQueue.push({ text: textTa, lang: 'ta', outputPath: path.join(c1Dir, 'rifle_ta.wav') });
    }
    // Pre-queue map instructions
    const mapTextEn = "Map Trace of the Sepoy Mutiny 1857. Tap the red pulsing dots on the map to explore key historical events.";
    const mapTextTa = "1857 சிப்பாய் கலகத்தின் வரைபடப் பாதை. வரைபடத்தில் உள்ள சிவப்பு நிற துடிக்கும் புள்ளிகளைத் தட்டி முக்கிய வரலாற்று நிகழ்வுகளை ஆராயுங்கள்.";
    ttsQueue.push({ text: mapTextEn, lang: 'en', outputPath: path.join(c1Dir, 'map_en.wav') });
    ttsQueue.push({ text: mapTextTa, lang: 'ta', outputPath: path.join(c1Dir, 'map_ta.wav') });

    // Pre-queue map location texts
    if (c1Data && c1Data.features && c1Data.features.map && c1Data.features.map.locations) {
      c1Data.features.map.locations.forEach(loc => {
        const pointsListEn = loc.points;
        const nameTextEn = loc.name;
        const textEn = `${nameTextEn}. ${pointsListEn.join('. ')}`;
        
        const pointsListTa = loc.points_ta || loc.points;
        const nameTextTa = loc.name_ta || loc.name;
        const textTa = `${nameTextTa}. ${pointsListTa.join('. ')}`;

        ttsQueue.push({
          text: textEn,
          lang: 'en',
          outputPath: path.join(c1Dir, `map_loc_${loc.id}_en.wav`)
        });
        ttsQueue.push({
          text: textTa,
          lang: 'ta',
          outputPath: path.join(c1Dir, `map_loc_${loc.id}_ta.wav`)
        });
      });
    }
  } catch(e) {
    console.error("Error queueing card1 cards:", e);
  }
  
  // Card 2
  try {
    const c2Data = require('./card2/data.js');
    if (Array.isArray(c2Data)) {
      c2Data.forEach(r => {
        if (r.en && r.en.desc) ttsQueue.push({ text: r.en.desc, lang: 'en', outputPath: path.join(c2Dir, `${r.id}_desc_en.wav`) });
        if (r.en && r.en.quote) ttsQueue.push({ text: r.en.quote, lang: 'en', outputPath: path.join(c2Dir, `${r.id}_quote_en.wav`) });
        if (r.ta && r.ta.desc) ttsQueue.push({ text: r.ta.desc, lang: 'ta', outputPath: path.join(c2Dir, `${r.id}_desc_ta.wav`) });
        if (r.ta && r.ta.quote) ttsQueue.push({ text: r.ta.quote, lang: 'ta', outputPath: path.join(c2Dir, `${r.id}_quote_ta.wav`) });
      });
    }
  } catch(e) {
    console.error("Error queueing card2 cards:", e);
  }
  // Card 3
  try {
    const c3Data = require('./card3/data.js');
    const c3Dir = path.join(rootDir, 'assets', 'cards', 'card3');
    
    function queueCard3Voice(lang, sectionId, text) {
      if (!text) return;
      const hash = Buffer.from(encodeURIComponent(text)).toString('base64').substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
      ttsQueue.push({ text: text, lang: lang, outputPath: path.join(c3Dir, `card3_voice_${sectionId}_${hash}_${lang}.wav`) });
    }

    ['en', 'ta'].forEach(lang => {
      if (c3Data.intro && c3Data.intro[lang]) {
         c3Data.intro[lang].sections.forEach((sec, idx) => queueCard3Voice(lang, `section-video-${idx}`, sec.text));
         if (c3Data.intro[lang].finalText) queueCard3Voice(lang, `section-video-final`, c3Data.intro[lang].finalText);
      }
      if (c3Data.timeline && c3Data.timeline[lang] && c3Data.timeline[lang].events) {
         c3Data.timeline[lang].events.forEach(ev => {
            queueCard3Voice(lang, 'section-timeline', `${ev.year}. ${ev.title}. ${ev.desc}`);
         });
      }
      if (c3Data.associates) {
         c3Data.associates.forEach(assoc => {
            const data = assoc[lang];
            if (data) queueCard3Voice(lang, 'section-associates', `${data.name}, ${data.years}. ${data.desc}`);
         });
      }
    });
  } catch(e) {
    console.error("Error queueing card3 cards:", e);
  }
  
  processQueue();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: false,       // ← disabled for laptop testing
    fullscreen: false,  // ← disabled for laptop testing
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(true); // show menu bar for easy close
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  cleanupAudio();
  queueAllCards();
  createWindow();

  globalShortcut.register('Escape', () => {
    app.quit();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

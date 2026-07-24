const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('log-level', '3');

// Resolve paths for Piper TTS engine
const voiceModelDir = app.isPackaged
  ? path.join(process.resourcesPath, 'Voice model')
  : path.join(__dirname, '..', 'assets', 'Voice model');

const piperExe = path.join(voiceModelDir, 'piper', 'piper.exe');
const enModel = path.join(voiceModelDir, 'models', 'en_IN-spicor-medium.onnx');
const taModel = path.join(voiceModelDir, 'models', 'ta_IN-rasa_female-medium.onnx');

// TTS cache directory (writable in both dev and production)
const ttsCacheDir = path.join(app.getPath('userData'), 'tts-cache');
if (!fs.existsSync(ttsCacheDir)) fs.mkdirSync(ttsCacheDir, { recursive: true });

// Expose paths to renderer
ipcMain.handle('get-tts-cache-dir', () => ttsCacheDir);

// Global TTS Queue
let ttsQueue = [];
let isGenerating = false;

function processQueue() {
  if (isGenerating || ttsQueue.length === 0) return;
  isGenerating = true;
  
  const job = ttsQueue.shift();
  
  if (fs.existsSync(job.outputPath)) {
    isGenerating = false;
    if (job.resolve) job.resolve(job.outputPath);
    return processQueue();
  }

  const model = job.lang === 'ta' ? taModel : enModel;
  console.log(`Generating TTS: ${job.outputPath}`);
  
  const outDir = path.dirname(job.outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const piperProcess = spawn(piperExe, ['-m', model, '-f', job.outputPath]);
  
  piperProcess.stdin.write(job.text);
  piperProcess.stdin.end();
  
  piperProcess.on('close', (code) => {
    isGenerating = false;
    if (code === 0) {
      if (job.resolve) job.resolve(job.outputPath);
    } else {
      console.error(`Piper failed with code ${code} for ${job.outputPath}`);
      if (job.reject) job.reject(new Error(`Piper failed`));
    }
    processQueue();
  });
}

// IPC Handle for frontend requests
ipcMain.handle('generate-tts', async (event, { text, lang, outputPath, priority }) => {
  return new Promise((resolve, reject) => {
    const job = { text, lang, outputPath, resolve, reject };
    if (priority) {
      ttsQueue.unshift(job);
    } else {
      ttsQueue.push(job);
    }
    processQueue();
  });
});

ipcMain.on('log', (event, ...args) => {
  console.log('[RENDERER LOG]', ...args);
});

// Pre-queue card1 TTS audio
function preQueueTTS() {
  try {
    const c1Data = require('./data.js');
    if (c1Data && c1Data.description) {
      ttsQueue.push({ text: c1Data.description.join(' '), lang: 'en', outputPath: path.join(ttsCacheDir, 'intro_en.wav') });
    }
    if (c1Data && c1Data.description_ta) {
      ttsQueue.push({ text: c1Data.description_ta.join(' '), lang: 'ta', outputPath: path.join(ttsCacheDir, 'intro_ta.wav') });
    }
    if (c1Data && c1Data.features && c1Data.features.timeline) {
      if (c1Data.features.timeline.events) {
        c1Data.features.timeline.events.forEach((ev, i) => {
          ttsQueue.push({ text: ev.description, lang: 'en', outputPath: path.join(ttsCacheDir, `timeline_${i}_en.wav`) });
        });
      }
      if (c1Data.features.timeline.events_ta) {
        c1Data.features.timeline.events_ta.forEach((ev, i) => {
          ttsQueue.push({ text: ev.description, lang: 'ta', outputPath: path.join(ttsCacheDir, `timeline_${i}_ta.wav`) });
        });
      }
    }
    if (c1Data && c1Data.features && c1Data.features.rifle) {
      const rifle = c1Data.features.rifle;
      const textEn = `${rifle.title} Calibre: ${rifle.details.Calibre}. Loading Mechanism: ${rifle.details.LoadingMechanism}. Lock Type: ${rifle.details.LockType}. Origin: ${rifle.details.Origin}. Ammunition: ${rifle.details.Ammunition}`;
      const textTa = `${rifle.title_ta} கலிபர்: ${rifle.details_ta["கலிபர்"]}. ஏற்றும் முறை: ${rifle.details_ta["ஏற்றும் முறை"]}. விசை வகை: ${rifle.details_ta["விசை வகை"]}. தயாரிப்பு: ${rifle.details_ta["தயாரிப்பு"]}. வெடிமருந்து: ${rifle.details_ta["வெடிமருந்து"]}`;
      ttsQueue.push({ text: textEn, lang: 'en', outputPath: path.join(ttsCacheDir, 'rifle_en.wav') });
      ttsQueue.push({ text: textTa, lang: 'ta', outputPath: path.join(ttsCacheDir, 'rifle_ta.wav') });
    }
    const mapTextEn = "Map Trace of the Sepoy Mutiny 1857. Tap the red pulsing dots on the map to explore key historical events.";
    const mapTextTa = "1857 சிப்பாய் கலகத்தின் வரைபடப் பாதை. வரைபடத்தில் உள்ள சிவப்பு நிற துடிக்கும் புள்ளிகளைத் தட்டி முக்கிய வரலாற்று நிகழ்வுகளை ஆராயுங்கள்.";
    ttsQueue.push({ text: mapTextEn, lang: 'en', outputPath: path.join(ttsCacheDir, 'map_en.wav') });
    ttsQueue.push({ text: mapTextTa, lang: 'ta', outputPath: path.join(ttsCacheDir, 'map_ta.wav') });
    if (c1Data && c1Data.features && c1Data.features.map && c1Data.features.map.locations) {
      c1Data.features.map.locations.forEach(loc => {
        const textEn = `${loc.name}. ${loc.points.join('. ')}`;
        const textTa = `${loc.name_ta || loc.name}. ${(loc.points_ta || loc.points).join('. ')}`;
        ttsQueue.push({ text: textEn, lang: 'en', outputPath: path.join(ttsCacheDir, `map_loc_${loc.id}_en.wav`) });
        ttsQueue.push({ text: textTa, lang: 'ta', outputPath: path.join(ttsCacheDir, `map_loc_${loc.id}_ta.wav`) });
      });
    }
  } catch (e) {
    console.error("Error pre-queueing TTS:", e);
  }
  processQueue();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: false,
    fullscreen: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(true);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  preQueueTTS();
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

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

// Pre-queue card3 TTS audio
function preQueueTTS() {
  try {
    const c3Data = require('./data.js');
    
    function queueVoice(lang, sectionId, text) {
      if (!text) return;
      const hash = Buffer.from(encodeURIComponent(text)).toString('base64').substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
      ttsQueue.push({ text, lang, outputPath: path.join(ttsCacheDir, `card3_voice_${sectionId}_${hash}_${lang}.wav`) });
    }

    ['en', 'ta'].forEach(lang => {
      if (c3Data.intro && c3Data.intro[lang]) {
        c3Data.intro[lang].sections.forEach((sec, idx) => queueVoice(lang, `section-video-${idx}`, sec.text));
        if (c3Data.intro[lang].finalText) queueVoice(lang, `section-video-final`, c3Data.intro[lang].finalText);
      }
      if (c3Data.timeline && c3Data.timeline[lang] && c3Data.timeline[lang].events) {
        c3Data.timeline[lang].events.forEach(ev => {
          queueVoice(lang, 'section-timeline', `${ev.year}. ${ev.title}. ${ev.desc}`);
        });
      }
      if (c3Data.associates) {
        c3Data.associates.forEach(assoc => {
          const data = assoc[lang];
          if (data) queueVoice(lang, 'section-associates', `${data.name}, ${data.years}. ${data.desc}`);
        });
      }
    });
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

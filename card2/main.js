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

// Pre-queue card2 TTS audio
function preQueueTTS() {
  try {
    const c2Data = require('./data.js');
    if (Array.isArray(c2Data)) {
      c2Data.forEach(r => {
        if (r.en && r.en.desc) ttsQueue.push({ text: r.en.desc, lang: 'en', outputPath: path.join(ttsCacheDir, `${r.id}_desc_en.wav`) });
        if (r.en && r.en.quote) ttsQueue.push({ text: r.en.quote, lang: 'en', outputPath: path.join(ttsCacheDir, `${r.id}_quote_en.wav`) });
        if (r.ta && r.ta.desc) ttsQueue.push({ text: r.ta.desc, lang: 'ta', outputPath: path.join(ttsCacheDir, `${r.id}_desc_ta.wav`) });
        if (r.ta && r.ta.quote) ttsQueue.push({ text: r.ta.quote, lang: 'ta', outputPath: path.join(ttsCacheDir, `${r.id}_quote_ta.wav`) });
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

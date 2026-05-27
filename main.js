const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const rootDir = __dirname;
const piperExe = path.join(rootDir, 'assets', 'Voice model', 'piper', 'piper.exe');
const enModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'en_US-lessac-medium.onnx');
const taModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'ta_IN-Valluvar-medium.onnx');

// Cleanup function to delete all .wav files in assets/card folders
function cleanupAudio() {
  const cardsDir = [
    path.join(rootDir, 'assets', 'Voice model', 'cards', 'card1'), 
    path.join(rootDir, 'assets', 'Voice model', 'cards', 'card2')
  ];
  cardsDir.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      if (file.endsWith('.wav')) {
        try { fs.unlinkSync(path.join(dir, file)); } catch (e) {}
      }
    });
  });
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

// Auto-queue all data
function queueAllCards() {
  const c1Dir = path.join(rootDir, 'assets', 'Voice model', 'cards', 'card1');
  const c2Dir = path.join(rootDir, 'assets', 'Voice model', 'cards', 'card2');
  
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
  } catch(e) {}
  
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
  } catch(e) {}
  
  processQueue();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: true,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
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

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname;
const card1Dir = path.join(rootDir, 'assets', 'cards', 'card1');
const card2Dir = path.join(rootDir, 'assets', 'cards', 'card2');
const cardsDir = [card1Dir, card2Dir];

const piperExe = path.join(rootDir, 'assets', 'Voice model', 'piper', 'piper.exe');
const enModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'en_IN-spicor-medium.onnx');
const taModel = path.join(rootDir, 'assets', 'Voice model', 'models', 'ta_IN-rasa_female-medium.onnx');

function deleteExistingWavs(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (file.endsWith('.wav')) {
      try {
        fs.unlinkSync(path.join(dir, file));
        console.log(`Deleted: ${file}`);
      } catch (err) {
        console.error(`Failed to delete ${file}:`, err);
      }
    }
  });
}

function generateWav(text, lang, outputPath) {
  if (!text) return;
  const model = lang === 'ta' ? taModel : enModel;
  
  // Ensure target directory exists
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`Generating: ${path.basename(outputPath)}...`);

  const child = spawnSync(piperExe, [
    '-m', model,
    '-f', outputPath
  ], {
    input: text,
    encoding: 'utf-8'
  });

  if (child.error) {
    console.error(`Error running piper for ${outputPath}:`, child.error);
  } else if (child.status !== 0) {
    console.error(`Piper failed for ${outputPath}:`, child.stderr);
  }
}

// 1. Clean up existing .wav files in all card folders
cardsDir.forEach(deleteExistingWavs);

console.log("Cleanup complete. Starting audio generation...");

// 2. Parse Card 1 (4 transitions / panels)
try {
  const uprisingData = require('./card1/data.js');
  if (uprisingData) {
    // 2.1 Hero Panel (Intro)
    if (uprisingData.description) {
      const enIntro = uprisingData.description.join(' ');
      generateWav(enIntro, 'en', path.join(card1Dir, 'intro_en.wav'));
    }
    if (uprisingData.description_ta) {
      const taIntro = uprisingData.description_ta.join(' ');
      generateWav(taIntro, 'ta', path.join(card1Dir, 'intro_ta.wav'));
    }

    // 2.2 Timeline Panel (Events)
    if (uprisingData.features && uprisingData.features.timeline) {
      const timeline = uprisingData.features.timeline;
      if (Array.isArray(timeline.events)) {
        timeline.events.forEach((ev, i) => {
          generateWav(ev.description, 'en', path.join(card1Dir, `timeline_${i}_en.wav`));
        });
      }
      if (Array.isArray(timeline.events_ta)) {
        timeline.events_ta.forEach((ev, i) => {
          generateWav(ev.description, 'ta', path.join(card1Dir, `timeline_${i}_ta.wav`));
        });
      }
    }

    // 2.3 Map Panel (Instructions)
    const enMapText = "Map Trace of the Sepoy Mutiny 1857. Tap the red pulsing dots on the map to explore key historical events.";
    const taMapText = "1857 சிப்பாய் கலகத்தின் வரைபடப் பாதை. வரைபடத்தில் உள்ள சிவப்பு நிற துடிக்கும் புள்ளிகளைத் தட்டி முக்கிய வரலாற்று நிகழ்வுகளை ஆராயுங்கள்.";
    generateWav(enMapText, 'en', path.join(card1Dir, 'map_en.wav'));
    generateWav(taMapText, 'ta', path.join(card1Dir, 'map_ta.wav'));

    // 2.4 Rifle Panel (Specs)
    if (uprisingData.features && uprisingData.features.rifle) {
      const rifle = uprisingData.features.rifle;
      if (rifle.title && rifle.details) {
        const enRifleText = `${rifle.title} Calibre: ${rifle.details.Calibre}. Loading Mechanism: ${rifle.details.LoadingMechanism}. Lock Type: ${rifle.details.LockType}. Origin: ${rifle.details.Origin}. Ammunition: ${rifle.details.Ammunition}`;
        generateWav(enRifleText, 'en', path.join(card1Dir, 'rifle_en.wav'));
      }
      if (rifle.title_ta && (rifle.details_ta || (rifle.details && rifle.details_ta))) {
        const details = rifle.details_ta || rifle.details;
        const taRifleText = `${rifle.title_ta} கலிபர்: ${details["கலிபர்"]}. ஏற்றும் முறை: ${details["ஏற்றும் முறை"]}. விசை வகை: ${details["விசை வகை"]}. தயாரிப்பு: ${details["தயாரிப்பு"]}. வெடிமருந்து: ${details["வெடிமருந்து"]}`;
        generateWav(taRifleText, 'ta', path.join(card1Dir, 'rifle_ta.wav'));
      }
    }
  }
} catch (e) {
  console.log('Error processing card1 data:', e.message);
}

// 3. Parse Card 2
try {
  const reformersData = require('./card2/data.js');
  if (Array.isArray(reformersData)) {
    reformersData.forEach(reformer => {
      // English
      if (reformer.en && reformer.en.desc) {
        generateWav(reformer.en.desc, 'en', path.join(card2Dir, `${reformer.id}_desc_en.wav`));
      }
      if (reformer.en && reformer.en.quote) {
        generateWav(reformer.en.quote, 'en', path.join(card2Dir, `${reformer.id}_quote_en.wav`));
      }
      
      // Tamil
      if (reformer.ta && reformer.ta.desc) {
        generateWav(reformer.ta.desc, 'ta', path.join(card2Dir, `${reformer.id}_desc_ta.wav`));
      }
      if (reformer.ta && reformer.ta.quote) {
        generateWav(reformer.ta.quote, 'ta', path.join(card2Dir, `${reformer.id}_quote_ta.wav`));
      }
    });
  }
} catch (e) {
  console.log('Error processing card2 data:', e.message);
}

console.log("Audio generation process fully completed.");

const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = {
  'raja_ram_mohan_roy.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Raja_Ram_Mohan_Roy.jpg/800px-Raja_Ram_Mohan_Roy.jpg',
  'ishwar_chandra_vidyasagar.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Ishwar_Chandra_Vidyasagar.jpg/800px-Ishwar_Chandra_Vidyasagar.jpg',
  'saint_ramalingar.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Ramalinga_Swamigal.jpg/800px-Ramalinga_Swamigal.jpg',
  'swami_dayananda_saraswati.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Swami_Dayananda_Saraswati.jpg/800px-Swami_Dayananda_Saraswati.jpg',
  'ramakrishna_paramahamsa.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Ramakrishna_Paramahamsa.jpg/800px-Ramakrishna_Paramahamsa.jpg',
  'swami_vivekananda.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Swami_Vivekananda-1893-09-signed.jpg/800px-Swami_Vivekananda-1893-09-signed.jpg'
};

const dir = path.join(__dirname, 'assets', 'card');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

Object.keys(urls).forEach(filename => {
  const file = fs.createWriteStream(path.join(dir, filename));
  const req = https.get(urls[filename], {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Downloaded ' + filename);
    });
  });
  req.on('error', err => console.log(err));
});

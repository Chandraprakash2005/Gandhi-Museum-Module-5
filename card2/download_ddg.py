import urllib.request
import json
import time
import os

queries = {
    'raja_ram_mohan_roy.jpg': 'Raja Ram Mohan Roy',
    'ishwar_chandra_vidyasagar.jpg': 'Ishwar Chandra Vidyasagar',
    'saint_ramalingar.jpg': 'Ramalinga Swamigal',
    'swami_dayananda_saraswati.jpg': 'Dayananda Saraswati',
    'ramakrishna_paramahamsa.jpg': 'Ramakrishna Paramahamsa',
    'swami_vivekananda.jpg': 'Swami Vivekananda'
}

for filename, query in queries.items():
    print(f"Fetching {query}...")
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        img_path = data.get('Image', '')
        
        if img_path:
            img_url = f"https://duckduckgo.com{img_path}"
            print(f"Downloading from {img_url}")
            img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
            img_res = urllib.request.urlopen(img_req)
            
            with open(os.path.join('assets', 'card', filename), 'wb') as f:
                f.write(img_res.read())
            print(f"Saved {filename}")
        else:
            print(f"No image found for {query}")
    except Exception as e:
        print(f"Error for {query}: {e}")
    time.sleep(1)

from flask import Flask, jsonify, request, send_file
from instagrapi import Client
import json
import os
from datetime import datetime
import random
from pathlib import Path

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

DATA_FILE = 'bot_data.json'
IG_USERNAME = os.getenv('INSTAGRAM_USERNAME', '')
IG_PASSWORD = os.getenv('INSTAGRAM_PASSWORD', '')
IG_ACCESS_TOKEN = os.getenv('INSTAGRAM_ACCESS_TOKEN', '')

# Initialize instagrapi client
ig_client = None

def init_instagram():
    global ig_client
    try:
        ig_client = Client()
        if IG_USERNAME and IG_PASSWORD:
            print(f"🔐 Instagram'a bağlanılıyor: {IG_USERNAME}")
            ig_client.login(IG_USERNAME, IG_PASSWORD)
            print("✅ Instagram bağlantısı başarılı")
        else:
            print("⚠️ Instagram credentials yok - demo mod")
    except Exception as e:
        print(f"❌ Instagram hatası: {e}")
        ig_client = None

def load_db():
    try:
        if Path(DATA_FILE).exists():
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                print('📂 Veritabanı yüklendi')
                return json.load(f)
    except Exception as e:
        print(f'DB yükleme hatası: {e}')
    return {'accounts': {}}

def save_db(db):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f'DB kaydetme hatası: {e}')

db = load_db()

def generate_profile():
    """Gerçekçi Türkçe profil oluştur"""
    names = ['Ahmet', 'Zeynep', 'Can', 'Elif', 'Murat', 'Ayşe', 'Ali', 'Seda', 'Emre', 'Gül', 'Ferhat', 'Dilara', 'Kerem', 'Melek', 'Levent']
    last = ['Kaya', 'Yıldız', 'Demir', 'Şahin', 'Özbek', 'Çelik', 'Yalçın', 'Aksoy', 'Çan', 'Demirkaya', 'Turhan', 'Esen', 'Aydın', 'Polat', 'Korkmaz']
    bios = ['Mühendis • İstanbul', 'Fotoğrafçı • Doğa', 'Yazılımcı • Startup', 'Moda blogger', 'Spor tutkunu', 'Şef • Yemek', 'Seyahat blogu', 'Yoga öğretmeni', 'Müzisyen', 'İç mimar', 'Grafik Tasarımcı', 'Danışman', 'Pazarlama Uzmanı', 'Blogger', 'Influencer']
    
    fname = random.choice(names)
    lname = random.choice(last)
    username = f"{fname.lower()}_{lname.lower()}_{random.randint(100, 9999)}"
    
    return {
        'id': f"uid_{datetime.now().timestamp()}_{random.randint(100000, 999999)}",
        'name': f"{fname} {lname}",
        'username': username,
        'bio': random.choice(bios),
        'avatar': f"https://ui-avatars.com/api/?name={fname}+{lname}&background=667eea&color=fff&bold=true&size=128",
        'verified': random.random() > 0.92,
        'followers': random.randint(100, 50000),
        'posts': random.randint(10, 1000)
    }

def get_real_followers(username):
    """instagrapi kullanarak gerçek takipçileri al"""
    if not ig_client:
        return []
    
    try:
        user_id = ig_client.user_id_from_username(username)
        followers = ig_client.user_followers(user_id, amount=50)
        
        result = []
        for follower in followers.values():
            result.append({
                'id': str(follower.pk),
                'name': follower.full_name or follower.username,
                'username': follower.username,
                'bio': follower.biography or 'Instagram kullanıcısı',
                'avatar': follower.profile_pic_url or f"https://ui-avatars.com/api/?name={follower.username}&background=667eea&color=fff&bold=true&size=128",
                'verified': follower.is_verified or False,
                'followers': follower.follower_count or 0,
                'posts': follower.media_count or 0
            })
        
        return result
    except Exception as e:
        print(f"Takipçi çekme hatası: {e}")
        return []

@app.route('/')
def index():
    return send_file('public/index.html')

@app.route('/api/account', methods=['POST'])
def create_account():
    data = request.get_json()
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Ad gerekli'}), 400
    
    if name not in db['accounts']:
        db['accounts'][name] = {
            'name': name,
            'followers': [],
            'created': datetime.now().isoformat()
        }
        save_db(db)
    
    return jsonify({'success': True})

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    accounts = [
        {
            'name': acc['name'],
            'count': len(acc.get('followers', [])),
            'created': acc.get('created')
        }
        for acc in db['accounts'].values()
    ]
    return jsonify({'accounts': accounts})

@app.route('/api/followers/<account>', methods=['GET'])
def get_followers(account):
    if account not in db['accounts']:
        return jsonify({'error': 'Hesap yok'}), 404
    
    acc = db['accounts'][account]
    followers = acc.get('followers', [])[:50]
    total = len(acc.get('followers', []))
    
    return jsonify({
        'followers': followers,
        'total': total
    })

@app.route('/api/followers/<account>/add', methods=['POST'])
def add_followers(account):
    if account not in db['accounts']:
        db['accounts'][account] = {
            'name': account,
            'followers': [],
            'created': datetime.now().isoformat()
        }
    
    data = request.get_json()
    count = min(int(data.get('count', 10)), 1000)
    
    acc = db['accounts'][account]
    new_followers = [generate_profile() for _ in range(count)]
    acc['followers'] = new_followers + acc.get('followers', [])
    
    save_db(db)
    
    return jsonify({
        'success': True,
        'added': count,
        'total': len(acc['followers'])
    })

@app.route('/api/followers/<account>/bulk', methods=['POST'])
def bulk_add_followers(account):
    if account not in db['accounts']:
        db['accounts'][account] = {
            'name': account,
            'followers': [],
            'created': datetime.now().isoformat()
        }
    
    data = request.get_json()
    count = min(int(data.get('count', 1000)), 50000)
    
    acc = db['accounts'][account]
    new_followers = [generate_profile() for _ in range(count)]
    acc['followers'] = new_followers + acc.get('followers', [])
    
    save_db(db)
    
    return jsonify({
        'success': True,
        'added': count,
        'total': len(acc['followers'])
    })

@app.route('/api/followers/<account>/real', methods=['POST'])
def add_real_followers(account):
    """Gerçek Instagram takipçilerini ekle"""
    if not ig_client:
        return jsonify({'error': 'Instagram bağlantısı yok'}), 400
    
    if account not in db['accounts']:
        db['accounts'][account] = {
            'name': account,
            'followers': [],
            'created': datetime.now().isoformat()
        }
    
    data = request.get_json()
    ig_username = data.get('username', '').strip()
    
    if not ig_username:
        return jsonify({'error': 'Instagram kullanıcı adı gerekli'}), 400
    
    try:
        real_followers = get_real_followers(ig_username)
        acc = db['accounts'][account]
        acc['followers'] = real_followers + acc.get('followers', [])
        save_db(db)
        
        return jsonify({
            'success': True,
            'added': len(real_followers),
            'total': len(acc['followers'])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/followers/<account>', methods=['DELETE'])
def delete_followers(account):
    if account in db['accounts']:
        db['accounts'][account]['followers'] = []
        save_db(db)
    
    return jsonify({'success': True})

@app.route('/api/account/<account>', methods=['DELETE'])
def delete_account(account):
    if account in db['accounts']:
        del db['accounts'][account]
        save_db(db)
    
    return jsonify({'success': True})

if __name__ == '__main__':
    init_instagram()
    print('✅ Instagram Bot başladı - Port 5000')
    app.run(host='0.0.0.0', port=5000, debug=False)

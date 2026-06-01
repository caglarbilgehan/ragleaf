# 🤖 Ragleaf - Modern RAG Sistemi

**PostgreSQL + pgvector** tabanlı, **microservices** mimarisine sahip, gelişmiş döküman işleme yetenekleriyle donatılmış, kurumsal seviye yapay zeka RAG sistemi.

> **Versiyon**: 5.4.1
> **Son Güncelleme**: 2026-01-19
> **Mimari**: PostgreSQL + pgvector (Unified Vector Store)

---

## 📋 İçindekiler

- [✨ Özellikler](#-özellikler)
- [🏗️ Sistem Mimarisi](#️-sistem-mimarisi)
- [🚀 Hızlı Başlangıç](#-hızlı-başlangıç)
- [📦 Projeler ve Teknolojiler](#-projeler-ve-teknolojiler)
  - [Backend (FastAPI)](#1-backend-fastapi)
  - [Admin Panel (React)](#2-platform-react)
  - [Chat UI (SvelteKit)](#3-chat-ui-sveltekit)
- [🌐 Erişim URL'leri](#-erişim-urlleri)
- [⚙️ Konfigürasyon](#️-konfigürasyon)
- [🔄 Vector Store](#-vector-store-mimarisi)
- [🔧 Sorun Giderme](#-sorun-giderme)
- [📈 Performans ve Optimizasyon](#-performans-ve-optimizasyon)

---

## ✨ Özellikler

### 🎯 Temel Özellikler

- **🗄️ Unified Vector Store**: PostgreSQL + pgvector (IVFFLAT index)
- **🏗️ Microservices**: OCR Service, Embedding Service ayrı container'larda
- **🧠 İki Çalışma Modu**:
  - **RAG Mode**: Döküman tabanlı, kaynak belirtmeli yanıtlar
  - **Chat Mode**: Normal AI asistanı sohbeti
- **📚 Gelişmiş Döküman İşleme**:
  - PDF (OCR desteği ile)
  - DOCX
  - TXT/MD
  - Batch ingestion
  - Real-time processing tracking
- **🔍 Akıllı Retrieval**:
  - Semantic search (cosine similarity)
  - Full-text search (BM25-like)
  - Hybrid search (RRF - Reciprocal Rank Fusion)
  - CLIP image embeddings (512-dim)
- **🎨 Modern Kullanıcı Arayüzleri**:
  - Professional chat interface (SvelteKit)
  - Comprehensive admin panel (React + TypeScript)
  - Mobile-responsive design
- **🔐 Kurumsal Güvenlik**:
  - JWT authentication
  - Role-based access control
  - Departman bazlı erişim kontrolü
- **📊 İzleme ve Analitik**:
  - Real-time statistics
  - RAG analytics
  - Token usage tracking
  - Ragas evaluation

### 🆕 V05 Yeni Özellikleri

- ✅ PostgreSQL + pgvector (Unified Vector Store)
- ✅ Microservices architecture (OCR, Embedding)
- ✅ CLIP semantic image search
- ✅ Multi-modal RAG (vision models)
- ✅ RAG analytics ve evaluation
- ✅ Token statistics ve cost tracking
- ✅ Departman bazlı erişim kontrolü
- ✅ Docker containerization
- ✅ Memory optimization

---

## 🏗️ Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAGLEAF PLATFORM SİSTEMİ                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Chat UI        │    │   Admin Panel     │    │   External Apps   │
│   (SvelteKit)    │    │   (React+TS)      │    │   (API Clients)   │
│   Port: 3000     │    │   Port: 5174      │    │                   │
└────────┬─────────┘    └────────┬──────────┘    └────────┬──────────┘
         │                       │                         │
         └───────────────────────┼─────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   API Gateway           │
                    │   (FastAPI)             │
                    │   Port: 8000            │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼────────┐ ┌──────▼──────┐ ┌────────▼────────┐
    │   OCR Service    │ │ Embedding   │ │   PostgreSQL    │
    │   (Tesseract)    │ │ Service     │ │   + pgvector    │
    │   Port: 8001     │ │ (PyTorch)   │ │   Port: 5432    │
    └──────────────────┘ │ Port: 8002  │ └─────────────────┘
                         └─────────────┘
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼────────┐ ┌──────▼──────┐ ┌────────▼────────┐
    │   MongoDB 7      │ │   Redis 7   │ │   File System   │
    │   (Sessions)     │ │   (Cache)   │ │   (Documents)   │
    │   Port: 27017    │ │ Port: 6379  │ │                 │
    └──────────────────┘ └─────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     External AI Services                         │
│  - HuggingFace API    - OpenAI API    - Anthropic API           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Kurulum ve Çalıştırma

### Ön Gereksinimler

| Gereksinim | Versiyon | Amaç |
|------------|----------|------|
| **Python** | 3.11+ | Backend |
| **Node.js** | 18+ | Frontend'ler |
| **npm** | 9.5.0+ | Paket yöneticisi |
| **Docker** | Latest | MongoDB için |
| **Git** | Latest | Versiyon kontrolü |

---

## 🔧 Development Ortamı Kurulumu

### 1️⃣ MongoDB Kurulumu ve Başlatma

#### Docker Compose ile MongoDB

```bash
# docker-compose.mongodb.yml dosyasını kullanarak MongoDB başlat
docker-compose -f docker-compose.mongodb.yml up -d

# Durum kontrolü
docker-compose -f docker-compose.mongodb.yml ps

# Logları görüntüle
docker-compose -f docker-compose.mongodb.yml logs -f mongodb
```

**Beklenen Çıktı:**
```
✓ MongoDB running on port 27017
✓ Data persisted to ./mongodb_data
```

---

### 2️⃣ Backend Kurulumu ve Başlatma

#### Python Virtual Environment Oluşturma

**Windows:**
```bash
# Backend klasörüne git
cd backend

# Virtual environment oluştur
python -m venv venv

# Virtual environment aktif et
venv\Scripts\activate

# Dependencies kur
pip install --upgrade pip
pip install -r requirements.txt

# .env dosyası oluştur
copy .env.example .env

# Gerekli dizinleri oluştur
mkdir -p database\vector_store\chroma_db
mkdir -p database\vector_store\faiss_index
mkdir -p logs

# Tesseract OCR kontrolü (Windows için)
# Tesseract'ı şu adresten indirin: https://github.com/UB-Mannheim/tesseract/wiki
# PATH'e ekleyin: C:\Program Files\Tesseract-OCR
```

**Linux/MacOS:**
```bash
# Backend klasörüne git
cd backend

# Virtual environment oluştur
python3 -m venv venv

# Virtual environment aktif et
source venv/bin/activate

# Dependencies kur
pip install --upgrade pip
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env

# Gerekli dizinleri oluştur
mkdir -p database/vector_store/chroma_db
mkdir -p database/vector_store/faiss_index
mkdir -p logs

# Tesseract OCR kur (Linux)
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-tur tesseract-ocr-eng
sudo apt-get install -y poppler-utils  # PDF işleme için

# MacOS için
brew install tesseract
brew install poppler
```

#### .env Dosyasını Yapılandırma

`.env` dosyasını düzenleyin:

```env
# Veritabanı
DATABASE_URL=sqlite:///./backend/rag_webui.db
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=rag-webui

# API Anahtarları (opsiyonel, kendi anahtarlarınızı ekleyin)
HUGGINGFACE_API_TOKEN=your_token_here
OPENAI_API_KEY=your_key_here

# Embedding Ayarları
EMBEDDING_MODEL=intfloat/multilingual-e5-base
CHUNK_SIZE=750
CHUNK_OVERLAP=100

# Vector Store
VECTORSTORE_ROOT=./backend/database/vector_store
COLLECTION_NAME=default

# Server
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5174
```

#### Backend'i Başlatma

```bash
# Virtual environment aktif olduğundan emin olun
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

# Development mode ile başlat
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Başarılı başlatma çıktısı:
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
# INFO:     Started reloader process
```

**Test edin:**
```bash
# Başka bir terminalde
curl http://localhost:8000/health
# Beklenen: {"status": "healthy"}

# API dokümantasyonu
# Tarayıcıda açın: http://localhost:8000/docs
```

---

### 3️⃣ Chat UI Kurulumu ve Başlatma

```bash
# Chat UI klasörüne git
cd chat-ui

# Dependencies kur
npm install

# .env.local dosyası oluştur
cp .env.example .env.local
```

#### .env.local Dosyasını Yapılandırma

`.env.local` dosyasını düzenleyin:

```env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chat-ui

# Backend Entegrasyonu
OPENAI_BASE_URL=http://localhost:8000/chatui
OPENAI_API_KEY=dummy_key

# Server
PORT=3001
PUBLIC_ORIGIN=http://localhost:3001

# App Customization
PUBLIC_APP_NAME=Ragleaf
PUBLIC_APP_DESCRIPTION=Modern RAG-based AI Chat System

# Features
ALLOW_IFRAME=true
EXPOSE_API=false
```

#### Chat UI'yi Başlatma

```bash
# Development mode ile başlat
npm run dev

# Başarılı başlatma çıktısı:
# > chat-ui@0.20.0 dev
# > vite dev
#
# VITE v6.3.5  ready in 1234 ms
#
# ➜  Local:   http://localhost:3001/
# ➜  Network: http://192.168.1.x:3001/
```

**Test edin:**
```bash
# Tarayıcıda açın: http://localhost:3001
```

---

### 4️⃣ Admin Panel Kurulumu ve Başlatma

```bash
# Admin Panel klasörüne git
cd platform

# Dependencies kur
npm install

# .env dosyası oluştur (opsiyonel, default değerler yeterli)
echo "VITE_API_URL=http://localhost:8000" > .env
```

#### Admin Panel'i Başlatma

```bash
# Development mode ile başlat
npm run dev

# Başarılı başlatma çıktısı:
# > rag-webui-admin@0.2.0 dev
# > vite
#
# VITE v5.0.0  ready in 567 ms
#
# ➜  Local:   http://localhost:5174/
# ➜  Network: http://192.168.1.x:5174/
```

**Test edin:**
```bash
# Tarayıcıda açın: http://localhost:5174
# Default admin login:
# Email: admin@example.com
# Password: admin123 (ilk kurulumda değiştirin)
```

---

### 5️⃣ İlk Kullanıcı ve Model Oluşturma

#### Backend'de Admin Kullanıcısı Oluşturma

```bash
# Backend virtual environment'ı aktif edin
cd backend
source venv/bin/activate  # Linux/Mac
# veya venv\Scripts\activate  # Windows

# Python interactive shell başlat
python

# Aşağıdaki komutları çalıştırın:
```

```python
from database.connection import SessionLocal
from database.models import User
from passlib.context import CryptContext

# Password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database session
db = SessionLocal()

# Admin kullanıcısı oluştur
admin_user = User(
    email="admin@example.com",
    password_hash=pwd_context.hash("admin123"),
    name="Admin",
    surname="User",
    is_admin=True,
    is_active=True
)

db.add(admin_user)
db.commit()
print(f"Admin kullanıcısı oluşturuldu: {admin_user.email}")

# Çıkış
exit()
```

---

### 6️⃣ Development Ortamı Özet

Tüm servisler çalışır durumda olmalı:

| Servis | URL | Durum Kontrolü |
|--------|-----|----------------|
| **MongoDB** | mongodb://localhost:27017 | `docker-compose -f docker-compose.mongodb.yml ps` |
| **Backend API** | http://localhost:8000 | `curl http://localhost:8000/health` |
| **Chat UI** | http://localhost:3001 | Tarayıcıda aç |
| **Admin Panel** | http://localhost:5174 | Tarayıcıda aç |
| **API Docs** | http://localhost:8000/docs | Tarayıcıda aç |

**Servisleri Durdurma:**

```bash
# Backend: Terminal'de CTRL+C
# Chat UI: Terminal'de CTRL+C
# Admin Panel: Terminal'de CTRL+C
# MongoDB: docker-compose -f docker-compose.mongodb.yml down
```

---

## 🏭 Production Ortamı Kurulumu

### 1️⃣ Docker ile Tam Stack Deployment (Önerilen)

#### docker-compose.yml Oluşturma

Proje kök dizininde `docker-compose.yml` dosyası oluşturun:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: ragleaf-postgres
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    networks:
      - ragleaf-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ragleaf-backend
    restart: always
    environment:
      - DATABASE_URL=sqlite:///./rag_webui.db
      - MONGODB_URL=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017
      - MONGODB_DB_NAME=rag-webui
      - SECRET_KEY=${SECRET_KEY}
      - HUGGINGFACE_API_TOKEN=${HUGGINGFACE_API_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CORS_ORIGINS=https://chat.yourdomain.com,https://admin.yourdomain.com
    volumes:
      - backend_data:/app/database
      - backend_logs:/app/logs
    ports:
      - "8000:8000"
    depends_on:
      - mongodb
    networks:
      - ragleaf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  chat-ui:
    build:
      context: ./chat-ui
      dockerfile: Dockerfile
    container_name: ragleaf-chatui
    restart: always
    environment:
      - MONGODB_URL=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017
      - MONGODB_DB_NAME=chat-ui
      - OPENAI_BASE_URL=http://backend:8000/chatui
      - PUBLIC_APP_NAME=Ragleaf AI Platform
      - PORT=3001
    ports:
      - "3001:3001"
    depends_on:
      - backend
      - mongodb
    networks:
      - ragleaf-network

  platform:
    build:
      context: ./platform
      dockerfile: Dockerfile
    container_name: ragleaf-admin
    restart: always
    environment:
      - VITE_API_URL=https://api.yourdomain.com
    ports:
      - "5174:80"
    depends_on:
      - backend
    networks:
      - ragleaf-network

  nginx:
    image: nginx:alpine
    container_name: ragleaf-nginx
    restart: always
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - chat-ui
      - platform
    networks:
      - ragleaf-network

volumes:
  mongodb_data:
  backend_data:
  backend_logs:

networks:
  ragleaf-network:
    driver: bridge
```

#### .env.production Dosyası

Proje kök dizininde `.env.production` dosyası oluşturun:

```env
# MongoDB
MONGO_PASSWORD=your_secure_password_here

# Backend
SECRET_KEY=your_very_long_random_secret_key_here
HUGGINGFACE_API_TOKEN=hf_your_token
OPENAI_API_KEY=sk-your_key

# Domain (opsiyonel)
DOMAIN=yourdomain.com
```

#### Nginx Konfigürasyonu

`nginx.conf` dosyası oluşturun:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream chatui {
        server chat-ui:3001;
    }

    upstream admin {
        server platform:80;
    }

    # Chat UI
    server {
        listen 80;
        server_name chat.yourdomain.com;

        # SSL için uncomment edin
        # listen 443 ssl http2;
        # ssl_certificate /etc/nginx/ssl/fullchain.pem;
        # ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://chatui;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Admin Panel
    server {
        listen 80;
        server_name admin.yourdomain.com;

        location / {
            proxy_pass http://admin;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Backend API
    server {
        listen 80;
        server_name api.yourdomain.com;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # CORS
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        }
    }
}
```

#### Docker Stack Başlatma

```bash
# .env.production dosyasını yükle
export $(cat .env.production | xargs)

# Tüm servisleri build et ve başlat
docker-compose --env-file .env.production up -d --build

# Logları izle
docker-compose logs -f

# Durum kontrolü
docker-compose ps
```

**Beklenen Çıktı:**
```
NAME                        STATUS              PORTS
ragleaf-backend        Up 2 minutes        0.0.0.0:8000->8000/tcp
ragleaf-chatui         Up 2 minutes        0.0.0.0:3001->3001/tcp
ragleaf-admin          Up 2 minutes        0.0.0.0:5174->80/tcp
ragleaf-postgres        Up 2 minutes        0.0.0.0:27017->27017/tcp
ragleaf-nginx               Up 2 minutes        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

---

### 2️⃣ Manuel Production Deployment

#### Backend Production Build

```bash
cd backend

# Python 3.11+ virtual environment
python3 -m venv venv
source venv/bin/activate

# Production dependencies
pip install --no-cache-dir -r requirements.txt

# .env.production
cp .env.example .env
# .env dosyasını production değerleriyle güncelleyin

# Gunicorn ile başlat (production WSGI server)
pip install gunicorn

# 4 worker process ile başlat
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log \
  --log-level info
```

**Systemd Service (Linux):**

`/etc/systemd/system/ragleaf-backend.service` dosyası oluşturun:

```ini
[Unit]
Description=Ragleaf RAG Backend
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/ragleaf/backend
Environment="PATH=/var/www/ragleaf/backend/venv/bin"
ExecStart=/var/www/ragleaf/backend/venv/bin/gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Service'i etkinleştir ve başlat
sudo systemctl enable ragleaf-backend
sudo systemctl start ragleaf-backend
sudo systemctl status ragleaf-backend
```

#### Chat UI Production Build

```bash
cd chat-ui

# Dependencies
npm ci --production

# .env.production
cp .env.example .env.production
# .env.production dosyasını güncelleyin

# Build
npm run build

# Production mode ile başlat
NODE_ENV=production npm run start

# Veya PM2 ile (önerilen)
npm install -g pm2
pm2 start npm --name "ragleaf-chatui" -- start
pm2 save
pm2 startup
```

#### Admin Panel Production Build

```bash
cd platform

# Dependencies
npm ci --production

# Build
npm run build

# dist/ klasörü oluşturuldu
# Nginx veya Apache ile serve edin
```

**Nginx Konfigürasyonu (Admin Panel):**

`/etc/nginx/sites-available/ragleaf-admin` dosyası:

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/ragleaf/platform/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Nginx konfigürasyonunu etkinleştir
sudo ln -s /etc/nginx/sites-available/ragleaf-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 3️⃣ SSL/TLS Sertifikası (Let's Encrypt)

```bash
# Certbot kur
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Sertifika al (tüm domain'ler için)
sudo certbot --nginx \
  -d chat.yourdomain.com \
  -d admin.yourdomain.com \
  -d api.yourdomain.com

# Otomatik yenileme testi
sudo certbot renew --dry-run
```

---

### 4️⃣ Production Monitoring

#### Health Check Script

`health_check.sh` dosyası oluşturun:

```bash
#!/bin/bash

echo "=== Ragleaf RAG Health Check ==="
echo ""

# Backend
echo "Backend API:"
curl -s http://localhost:8000/health | jq .
echo ""

# MongoDB
echo "MongoDB:"
docker exec ragleaf-postgres mongosh --eval "db.adminCommand('ping')" --quiet
echo ""

# Chat UI
echo "Chat UI:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001
echo ""

# Admin Panel
echo "Admin Panel:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5174
echo ""

# Disk usage
echo "Disk Usage:"
du -sh /var/www/ragleaf/backend/database/vector_store/*
echo ""

# Docker stats (if using Docker)
if [ -x "$(command -v docker)" ]; then
    echo "Docker Containers:"
    docker-compose ps
fi
```

```bash
chmod +x health_check.sh
./health_check.sh
```

#### Cron Job (Otomatik Backup)

```bash
# Crontab düzenle
crontab -e

# Her gün 02:00'de backup al
0 2 * * * /var/www/ragleaf/scripts/backup.sh
```

`backup.sh` dosyası:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/ragleaf"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# SQLite backup
cp /var/www/ragleaf/backend/rag_webui.db $BACKUP_DIR/rag_webui_$DATE.db

# MongoDB backup
docker exec ragleaf-postgres mongodump --out=/tmp/backup_$DATE
docker cp ragleaf-postgres:/tmp/backup_$DATE $BACKUP_DIR/mongodb_$DATE

# Vector store backup
tar -czf $BACKUP_DIR/vector_store_$DATE.tar.gz \
  /var/www/ragleaf/backend/database/vector_store/

# Eski backup'ları temizle (30 günden eski)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

---

### 5️⃣ Production Deployment Checklist

- [ ] `.env` dosyaları production değerleriyle güncellendi
- [ ] `SECRET_KEY` güvenli rastgele bir string
- [ ] API anahtarları yapılandırıldı (HuggingFace, OpenAI)
- [ ] CORS origins production domain'leri içeriyor
- [ ] MongoDB güçlü şifre ile korunuyor
- [ ] SSL/TLS sertifikaları yapılandırıldı
- [ ] Firewall kuralları yapılandırıldı (sadece 80, 443 portları açık)
- [ ] Health check endpoint'leri test edildi
- [ ] Backup stratejisi kuruldu
- [ ] Log rotation yapılandırıldı
- [ ] Monitoring (opsiyonel: Prometheus, Grafana) kuruldu
- [ ] Admin kullanıcısı oluşturuldu ve varsayılan şifre değiştirildi
- [ ] Vector store dizinleri oluşturuldu ve izinleri ayarlandı
- [ ] Sistem kaynaklarısufficient (RAM: 8GB+, Disk: 50GB+)

---

## 📦 Projeler ve Teknolojiler

### 1. Backend (FastAPI)

**Konum**: `./backend/`
**Port**: 8000
**Framework**: FastAPI 0.104.1 + Uvicorn 0.24.0

#### 📁 Klasör Yapısı

```
backend/
├── api/                      # FastAPI routers (25 dosya, 8255 satır)
│   ├── admin.py             # Admin API (1828 satır)
│   ├── chat.py              # Chat endpoint (474 satır)
│   ├── chatui_integration.py # ChatUI entegrasyonu (911 satır)
│   ├── vectorstore_admin.py # Vector store yönetimi (246 satır)
│   └── ...
├── services/                 # Business logic (27 dosya)
│   ├── vectorstore_manager.py
│   ├── embeddings.py
│   ├── enhanced_rag_service.py
│   ├── document_processor.py
│   └── ...
├── database/                 # ORM models
│   ├── models.py
│   ├── connection.py
│   └── vector_store/        # Hibrit vector store
│       ├── chroma_db/       # Persistent Chroma
│       └── faiss_index/     # Fast FAISS
├── auth/                     # JWT authentication
├── migrations/               # Database migrations (15+ dosya)
├── retrievers/               # RAG retrievers
├── utils/                    # Utilities
├── main.py                   # Entry point
├── requirements.txt          # Production dependencies
├── requirements-dev.txt      # Development dependencies
├── Dockerfile
└── .env.example
```

#### 🛠️ Teknoloji Stack

| Kategori | Teknoloji |
|----------|-----------|
| **Framework** | FastAPI 0.104.1, Uvicorn 0.24.0 |
| **Database** | SQLAlchemy 2.0 (SQLite/PostgreSQL) |
| **Vector DB** | Chroma (Persistent), FAISS 1.8.0 (Fast) |
| **AI/LLM** | HuggingFace, OpenAI, Anthropic, LangChain |
| **Embedding** | Sentence Transformers, intfloat/multilingual-e5-base |
| **Document** | PyPDF, Tesseract-OCR, pdf2image, pillow |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Cache** | Redis 5.0.1 |
| **Async** | aiofiles, aiohttp |

#### 🔌 Ana API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/` | GET | API info |
| `/health` | GET | Health check |
| `/docs` | GET | Swagger UI |
| **Authentication** |
| `/auth/register` | POST | Kullanıcı kaydı |
| `/auth/login` | POST | Giriş |
| `/auth/me` | GET | Profil bilgisi |
| **Chat** |
| `/chat` | POST | Ana chat endpoint (RAG/Chat mode) |
| **Documents** |
| `/documents/` | GET | Döküman listesi |
| `/documents/{id}` | DELETE | Döküman sil |
| **Admin** |
| `/admin/documents` | GET | Tüm dökümanlar |
| `/admin/documents/upload` | POST | Döküman yükle |
| `/admin/documents/{id}/process` | POST | İşleme başlat |
| `/admin/models` | GET/POST/PUT/DELETE | Model yönetimi |
| `/admin/statistics/*` | GET | İstatistikler |
| `/admin/settings/*` | GET/POST/PUT | Ayarlar |
| **Vector Store** |
| `/api/ingest/documents/ingest` | POST | Döküman ingestion |
| `/api/query/rag` | POST | RAG sorgusu |
| `/api/admin/vectorstore/status` | GET | Vector store durumu |
| `/api/admin/vectorstore/health` | GET | Sağlık kontrolü |
| `/api/admin/vectorstore/rebuild-faiss` | POST | FAISS rebuild |
| `/api/admin/settings/vectorstore` | GET/PUT | VS ayarları |

#### 📊 Database Models

- **User**: Kullanıcı hesapları (email, password, role)
- **Document**: Dökümanlar (filename, status, pages, chunks)
- **ModelConfig**: AI model yapılandırmaları
- **AIProvider**: AI servis sağlayıcıları
- **Settings**: Sistem ayarları (JSON)
- **UserStatistics**: Kullanıcı istatistikleri
- **ConversationStatistics**: Sohbet metrikleri
- **SystemUsageStatistics**: Sistem kullanımı

#### 🚀 Çalıştırma

```powershell
# Development mode
.\start-backend.ps1 -Dev

# Production mode
.\start-backend.ps1 -Prod

# Docker
docker build -f backend/Dockerfile -t ragleaf:latest .
docker run -p 8000:8000 ragleaf:latest
```

#### 🔑 Temel Özellikler

- ✅ Hibrit Vector Store (Chroma + FAISS)
- ✅ Multi-provider LLM support (HuggingFace, OpenAI, Anthropic)
- ✅ OCR entegrasyonu (Tesseract)
- ✅ Streaming chat (SSE)
- ✅ JWT authentication
- ✅ Redis caching
- ✅ Real-time statistics
- ✅ Admin API
- ✅ Health checks (K8s compatible)
- ✅ Database migrations (Alembic)

---

### 2. Admin Panel (React)

**Konum**: `./platform/`
**Port**: 5174
**Framework**: React 18 + Vite + TypeScript

#### 📁 Klasör Yapısı

```
platform/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── DashboardLayout.tsx      # Ana layout
│   │   ├── ui/                          # Reusable UI components
│   │   │   ├── button.tsx, card.tsx, input.tsx
│   │   │   ├── select.tsx, switch.tsx, tabs.tsx
│   │   │   └── ...
│   │   ├── AddModelModal.tsx            # Model ekleme
│   │   ├── EditModelModal.tsx           # Model düzenleme
│   │   ├── HuggingFaceAddModelModal.tsx # HF model seçimi
│   │   ├── DocumentDetailsModal.tsx     # Döküman detayları
│   │   ├── DocumentProgressModal.tsx    # İşlem ilerlemesi
│   │   ├── EditUserModal.tsx            # Kullanıcı düzenleme
│   │   ├── BulkIngestModal.tsx          # Toplu yükleme
│   │   ├── VectorStoreStatusCard.tsx    # VS durumu
│   │   └── VectorStoreSettingsForm.tsx  # VS ayarları
│   ├── pages/
│   │   ├── Dashboard.tsx                # Ana gösterge paneli
│   │   ├── DocumentsPage.tsx            # Döküman yönetimi
│   │   ├── ModelsPage.tsx               # Model yönetimi
│   │   ├── UsersPage.tsx                # Kullanıcı yönetimi
│   │   ├── StatisticsPage.tsx           # İstatistikler
│   │   ├── SettingsPage.tsx             # Ayarlar
│   │   └── LoginPage.tsx                # Admin girişi
│   ├── services/
│   │   └── api.ts                       # API client (Axios)
│   ├── types/
│   │   └── index.ts                     # TypeScript types
│   ├── App.tsx                          # Main app
│   └── main.tsx                         # Entry point
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── nginx.conf
```

#### 🛠️ Teknoloji Stack

| Kategori | Teknoloji |
|----------|-----------|
| **Framework** | React 18.2.0 |
| **Language** | TypeScript 5.2.2 |
| **Build Tool** | Vite 5.0.0 |
| **Styling** | Tailwind CSS 3.3.6 |
| **State Management** | React Query 3.39.3 |
| **Forms** | React Hook Form 7.48.2 |
| **HTTP Client** | Axios 1.6.2 |
| **Routing** | React Router DOM 6.20.1 |
| **Icons** | Lucide React 0.294.0 |
| **Charts** | Recharts 2.8.0 |
| **Notifications** | React Hot Toast 2.4.1 |
| **UI Components** | Headless UI 1.7.17 |

#### 📄 Sayfalar ve Özellikler

##### Dashboard
- Sistem istatistikleri (döküman, model, kullanıcı sayıları)
- Döküman durumu (işlenmiş, işleniyor, hatalı)
- Depolama kullanımı
- Sistem sağlık durumu (Backend, DB, AI Services)
- Hızlı işlemler

##### Dökümanlar
- Dosya yükleme (single/bulk)
- Döküman listesi (search, filter)
- İşlem durumu takibi (real-time)
- Vector Store durumu
- Döküman özellikleri ve detayları

##### Modeller
- AI Model listesi
- Model ekleme/düzenleme/silme
- HuggingFace entegrasyonu
- Model parametreleri:
  - LLM: temperature, top_p, top_k, num_ctx, num_predict
  - RAG: chunk_size, chunk_overlap, rag_top_k
  - System: timeout, stream_enabled

##### Kullanıcılar
- Kullanıcı listesi
- Kullanıcı ekleme/düzenleme/silme
- Rol yönetimi (Admin/User)
- Durum yönetimi (Aktif/Pasif)

##### İstatistikler
- Overview (özet)
- Performance (performans metrikleri)
- Timeline (zaman serisi)
- Errors (hata analizi)
- Grafik görsellendirme (Bar, Line, Pie charts)

##### Ayarlar
- **AI Services**: API key yönetimi, HuggingFace config
- **Vector Store**: Embedding model, chunk parametreleri, reranker
- **File Processing**: OCR ayarları (planlanan)

#### 🚀 Çalıştırma

```bash
cd platform

# Development
npm run dev           # http://localhost:5174

# Production
npm run build         # dist/ klasörüne build
npm run preview       # Build önizleme

# Linting
npm run lint
```

#### 🔑 Temel Özellikler

- ✅ Comprehensive admin dashboard
- ✅ Real-time data updates (React Query)
- ✅ Professional UI/UX (Tailwind + Lucide)
- ✅ Hybrid Vector Store UI
- ✅ Document processing tracking
- ✅ Model configuration interface
- ✅ User management
- ✅ Statistics and analytics
- ✅ Mobile-responsive design
- ✅ Type-safe (TypeScript)

---

### 3. Chat UI (SvelteKit)

**Konum**: `./chat-ui/`
**Port**: 3001
**Framework**: SvelteKit 2.48.4

#### 📁 Klasör Yapısı

```
chat-ui/
├── src/
│   ├── routes/                           # File-based routing
│   │   ├── +layout.svelte               # Root layout
│   │   ├── +page.svelte                 # Ana sayfa
│   │   ├── conversation/
│   │   │   ├── +server.ts               # POST endpoint (yeni sohbet)
│   │   │   └── [id]/
│   │   │       ├── +page.svelte         # Main chat UI (466 satır)
│   │   │       ├── +page.server.ts      # Server-side loader
│   │   │       ├── +server.ts           # GET/PATCH/DELETE
│   │   │       ├── share/+server.ts     # Share conversation
│   │   │       └── stop-generating/+server.ts
│   │   ├── api/
│   │   │   ├── conversations/+server.ts
│   │   │   ├── user/+server.ts
│   │   │   ├── fetch-url/+server.ts
│   │   │   └── v2/[...slugs]/+server.ts # Elysia API proxy
│   │   ├── settings/
│   │   │   ├── (nav)/+page.svelte       # Settings
│   │   │   ├── (nav)/[...model]/+page.svelte
│   │   │   └── (nav)/application/+page.svelte
│   │   ├── login/
│   │   │   ├── +server.ts               # OAuth trigger
│   │   │   └── callback/+server.ts      # OAuth callback
│   │   ├── logout/+server.ts
│   │   ├── admin/
│   │   │   ├── export/+server.ts
│   │   │   └── stats/compute/+server.ts
│   │   ├── healthcheck/+server.ts       # Health probe
│   │   ├── metrics/+server.ts           # Prometheus
│   │   └── r/[id]/+page.server.ts      # Shared links
│   ├── lib/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.svelte
│   │   │   │   └── MarkdownRenderer.svelte
│   │   │   ├── NavMenu.svelte
│   │   │   ├── MobileNav.svelte
│   │   │   ├── LoginModal.svelte
│   │   │   └── ...
│   │   └── server/
│   │       ├── database.ts              # MongoDB collections
│   │       ├── auth.ts                  # OIDC authentication
│   │       ├── models.ts                # Model management
│   │       ├── textGeneration.ts        # LLM integration
│   │       └── ragWebUIIntegration.ts   # Token integration
│   ├── app.html
│   └── hooks.server.ts
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tailwind.config.cjs
```

#### 🛠️ Teknoloji Stack

| Kategori | Teknoloji |
|----------|-----------|
| **Framework** | SvelteKit 2.48.4, Svelte 5.33.3 |
| **Language** | TypeScript 5.5.0 |
| **Backend** | Elysia 1.3.2 (Bun runtime) |
| **Database** | MongoDB 5.8.0 |
| **Validation** | Zod 3.22.3 |
| **Auth** | openid-client 5.4.2 (OIDC) |
| **LLM** | @huggingface/inference 4.11.3, OpenAI SDK 4.44.0 |
| **Markdown** | marked 12.0.1, KaTeX 0.16.21 |
| **Syntax** | highlight.js 11.7.0 |
| **UI** | Tailwind CSS 3.4.0, bits-ui 2.14.2 |
| **Build** | Vite 6.3.5 |
| **Testing** | Vitest 3.1.4, Playwright 1.55.1 |

#### 🔌 Ana Routes ve API

| Route | Method | Açıklama |
|-------|--------|----------|
| `/` | GET | Chat başlatma sayfası |
| `/conversation/[id]` | GET | Ana chat penceresi |
| `/conversation` | POST | Yeni sohbet oluştur |
| `/conversation/[id]` | PATCH/DELETE | Sohbet güncelle/sil |
| `/conversation/[id]/share` | POST | Sohbet paylaş |
| `/api/conversations` | GET | Kullanıcı sohbetleri |
| `/api/user` | GET | Kullanıcı bilgisi |
| `/api/fetch-url` | POST | URL içeriği getir |
| `/settings` | GET | Kullanıcı ayarları |
| `/login` | GET | OAuth girişi |
| `/logout` | POST | Çıkış |
| `/healthcheck` | GET | Health probe |
| `/metrics` | GET | Prometheus metrics |
| `/r/[id]` | GET | Paylaşılan sohbet |

#### 💬 Chat Özellikleri

- ✅ Real-time streaming responses (SSE)
- ✅ Markdown + KaTeX math rendering
- ✅ Code syntax highlighting
- ✅ Message tree (branching conversations)
- ✅ Message editing & regeneration
- ✅ File attachments
- ✅ URL preview loading
- ✅ Conversation sharing
- ✅ Mobile-responsive UI
- ✅ Dark mode support
- ✅ Background generation polling

#### 🚀 Çalıştırma

```bash
cd chat-ui

# Development
npm run dev           # http://localhost:3001

# Production
npm run build
npm run start

# Maintenance
npm run check         # Type checking
npm run lint          # Code quality
npm run test          # Run tests
```

#### 🔑 Temel Özellikler

- ✅ SvelteKit full-stack (SSR + API)
- ✅ File-based routing
- ✅ OpenAI-compatible LLM APIs
- ✅ OIDC authentication
- ✅ MongoDB conversation storage
- ✅ Session management
- ✅ Admin export/backup
- ✅ Prometheus metrics
- ✅ LLM router support
- ✅ Ragleaf backend entegrasyonu

---

## 🌐 Erişim URL'leri

### Development (Localhost)

| Servis | URL | Port | Açıklama |
|--------|-----|------|----------|
| **Chat UI** | http://localhost:3001 | 3001 | Ana sohbet arayüzü |
| **Admin Panel** | http://localhost:5174 | 5174 | Yönetim paneli |
| **Backend API** | http://localhost:8000 | 8000 | REST API |
| **API Docs** | http://localhost:8000/docs | 8000 | Swagger UI (OpenAPI) |
| **Health Check** | http://localhost:8000/health | 8000 | Sağlık kontrolü |
| **MongoDB** | mongodb://localhost:27017 | 27017 | Veritabanı |

### Production (Cloudflare Tunnel)

| Servis | URL | Açıklama |
|--------|-----|----------|
| **Chat UI** | https://chat.ragleaftr.com | Ana sohbet arayüzü |
| **Admin Panel** | https://chat-admin.ragleaftr.com | Yönetim paneli |
| **Backend API** | https://chat-api.ragleaftr.com | REST API |

#### 🚀 Cloudflare Tunnel ile Yayınlama

Uygulamanızı Cloudflare Tunnel üzerinden yayınlamak için:

```bash
# Docker ile tüm servisleri başlat
./start-docker-services.ps1  # Windows
# veya
./start-docker-services.sh   # Linux/Mac

# Cloudflare Tunnel başlat
cloudflared tunnel --config cloudflare-tunnel-config.yml run rag-webui
```

**Detaylı kurulum için:** [CLOUDFLARE_TUNNEL_SETUP.md](CLOUDFLARE_TUNNEL_SETUP.md)

---

## ⚙️ Konfigürasyon

### Backend (.env)

```env
# Genel Ayarlar
SECRET_KEY=<güvenli-random-key>
APP_VERSION=0.5.0.1
DEBUG=false

# Veritabanı
DATABASE_URL=sqlite:///./backend/rag_webui.db
# PostgreSQL için: postgresql://user:pass@host:5432/db
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=rag-webui

# API Anahtarları
HUGGINGFACE_API_TOKEN=hf_***
OPENAI_API_KEY=sk-***
ANTHROPIC_API_KEY=sk-ant-***

# Embedding Ayarları
EMBEDDING_MODEL=intfloat/multilingual-e5-base
DEFAULT_EMBEDDING_MODE=local
CHUNK_SIZE=750
CHUNK_OVERLAP=100

# Vector Store (Hibrit)
VECTORSTORE_ROOT=./backend/database/vector_store
CHROMA_DIR=${VECTORSTORE_ROOT}/chroma_db
FAISS_DIR=${VECTORSTORE_ROOT}/faiss_index
COLLECTION_NAME=default
RERANKER_MODEL=BAAI/bge-reranker-large

# Server
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5174
MAX_FILE_SIZE_MB=100

# Redis (Opsiyonel)
REDIS_URL=redis://localhost:6379/0
```

### Chat UI (.env.local)

```env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chat-ui

# Backend Entegrasyonu
OPENAI_BASE_URL=http://localhost:8000/chatui
OPENAI_API_KEY=dummy_key

# HuggingFace (Alternatif)
# OPENAI_BASE_URL=https://router.huggingface.co/v1
# OPENAI_API_KEY=hf_***

# Server
PORT=3001
APP_BASE=/

# Authentication (OIDC)
OAUTH_PROVIDER_URL=https://auth.example.com
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
ALLOWED_USER_EMAILS=["user1@example.com","user2@example.com"]
ALLOWED_USER_DOMAINS=["example.com"]

# UI Customization
PUBLIC_APP_NAME=Ragleaf AI Platform
PUBLIC_APP_ASSETS=chatui
PUBLIC_APP_DESCRIPTION=Modern RAG tabanlı AI chat sistemi
PUBLIC_APP_DATA_SHARING=0

# Features
ALLOW_IFRAME=true
EXPOSE_API=false
METRICS_ENABLED=false
```

### Admin Panel (.env / environment variables)

```env
# API Base URL
VITE_API_URL=http://localhost:8000

# Production için
# VITE_API_URL=https://chat-api.ragleaftr.com
```

---

## 🔄 Hibrit Vector Store Mimarisi

### Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────┐
│                     Döküman Ingestion                        │
│  (PDF, DOCX, TXT) → Chunking → Embedding Generation        │
└─────────────────────┬──────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────┐            ┌─────▼─────┐
    │  CHROMA  │            │   FAISS   │
    │(Persist) │            │  (Speed)  │
    │          │            │           │
    │ Metadata │            │ In-Memory │
    │ Filter   │            │ Fast      │
    │ 768-dim  │            │ 768-dim   │
    └────┬─────┘            └─────┬─────┘
         │                         │
         └────────────┬────────────┘
                      │
           ┌──────────▼──────────┐
           │ EnsembleRetriever   │
           │ (Chroma 30% +       │
           │  FAISS 70%)         │
           └──────────┬──────────┘
                      │
              ┌───────▼────────┐
              │  BGE Reranker  │
              │  (Opsiyonel)   │
              └───────┬────────┘
                      │
                  ┌───▼───┐
                  │  LLM  │
                  │(RAG)  │
                  └───────┘
```

### Özellikler ve Avantajlar

| Özellik | Chroma | FAISS | Ensemble |
|---------|--------|-------|----------|
| **Kalıcılık** | ✅ Otomatik persist | ❌ Manuel save | ✅ Chroma persists |
| **Hız** | ⚡ İyi | ⚡⚡⚡ Çok hızlı | ⚡⚡ Hızlı |
| **Metadata** | ✅ Zengin filtreleme | ❌ Sınırlı | ✅ Chroma'dan |
| **Bellek** | 💾 Disk tabanlı | 💾 RAM tabanlı | 💾 Hibrit |
| **Ölçeklenebilirlik** | ✅ Yüksek | ⚠️ RAM sınırlı | ✅ Yüksek |
| **Incremental** | ✅ Otomatik | ⚠️ Merge gerekli | ✅ Otomatik |

### Embedding Modelleri

| Model | Dil | Boyut | Hız | Kalite |
|-------|-----|-------|-----|--------|
| **intfloat/multilingual-e5-base** (Varsayılan) | TR+EN | 768 | ⚡⚡ | ⭐⭐⭐⭐ |
| all-MiniLM-L6-v2 | EN | 384 | ⚡⚡⚡ | ⭐⭐⭐ |
| paraphrase-multilingual-MiniLM-L12-v2 | Multi | 384 | ⚡⚡ | ⭐⭐⭐ |
| intfloat/multilingual-e5-large | TR+EN | 1024 | ⚡ | ⭐⭐⭐⭐⭐ |
| BAAI/bge-base-en-v1.5 | EN | 768 | ⚡⚡ | ⭐⭐⭐⭐ |
| BAAI/bge-m3 | Multi | 1024 | ⚡ | ⭐⭐⭐⭐⭐ |

### Döküman Ingestion

#### CLI ile (Önerilen)

```bash
# Klasördeki tüm dökümanları ingest et
python scripts/ingest_path.py ./documents/sample_docs

# Belirli uzantıları işle
python scripts/ingest_path.py ./documents --extensions .pdf .docx .txt

# Batch boyutu ayarla
python scripts/ingest_path.py ./documents --batch-size 5

# Verbose output
python scripts/ingest_path.py ./documents --verbose
```

#### API ile

```bash
# Single file upload
curl -X POST "http://localhost:8000/api/ingest/documents/ingest" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@document.pdf"

# Multiple files
curl -X POST "http://localhost:8000/api/ingest/documents/ingest" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.docx" \
  -F "files=@doc3.txt"
```

#### Admin Panel ile

1. Admin Panel'e giriş yapın (http://localhost:5174)
2. "Dökümanlar" sekmesine gidin
3. "Upload" veya "Bulk Ingest" butonuna tıklayın
4. Dosyaları seçin veya sürükleyin
5. İşlem durumunu real-time takip edin

### RAG Query

```bash
# Temel sorgu
curl -X POST "http://localhost:8000/api/query/rag" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Yangın paneli nasıl programlanır?",
    "top_k": 5
  }'

# Gelişmiş sorgu (ağırlıklar + reranking)
curl -X POST "http://localhost:8000/api/query/rag" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "3D yazıcı hataları nelerdir?",
    "top_k": 10,
    "chroma_weight": 0.3,
    "faiss_weight": 0.7,
    "enable_reranking": true,
    "reranker_top_k": 5
  }'
```

### FAISS Index Rebuild

```bash
# CLI ile (haftalık bakım için önerilen)
python scripts/rebuild_faiss.py

# API ile
curl -X POST "http://localhost:8000/api/admin/vectorstore/rebuild-faiss"

# Admin Panel'den (UI)
# Settings → Vector Store → "Rebuild FAISS Index" butonu
```

### Vector Store Status

```bash
# Durum kontrolü
curl http://localhost:8000/api/admin/vectorstore/status

# Sağlık kontrolü
curl http://localhost:8000/api/admin/vectorstore/health

# Detaylı istatistikler
curl http://localhost:8000/api/admin/vectorstore/stats
```

**Örnek Yanıt:**

```json
{
  "status": "healthy",
  "embedding_model": "intfloat/multilingual-e5-base",
  "vector_dimension": 768,
  "chroma": {
    "collection_name": "default",
    "document_count": 1547,
    "last_persist": "2025-11-09T15:30:00Z",
    "storage_path": "./backend/database/vector_store/chroma_db",
    "storage_size_mb": 125.4
  },
  "faiss": {
    "index_type": "IndexFlatL2",
    "vector_count": 1547,
    "last_rebuild": "2025-11-09T14:00:00Z",
    "storage_path": "./backend/database/vector_store/faiss_index",
    "storage_size_mb": 45.2
  },
  "ensemble": {
    "chroma_weight": 0.3,
    "faiss_weight": 0.7,
    "reranker_enabled": true,
    "reranker_model": "BAAI/bge-reranker-large"
  }
}
```

### Performans Benchmark

```bash
# 100 sentetik sorgu ile test
python scripts/bench_retrieval.py

# Özel sorgular ile
python scripts/bench_retrieval.py \
  --queries "sorgu1" "sorgu2" "sorgu3" \
  --top-k 10

# Sonuçları CSV'ye kaydet
python scripts/bench_retrieval.py --output results.csv

# Detaylı çıktı
python scripts/bench_retrieval.py --verbose
```

### Bakım Scriptleri

| Script | Açıklama | Kullanım |
|--------|----------|----------|
| `scripts/ingest_path.py` | Klasördeki dökümanları ingest et | `python scripts/ingest_path.py ./docs` |
| `scripts/rebuild_faiss.py` | FAISS'i Chroma'dan rebuild et | `python scripts/rebuild_faiss.py` |
| `scripts/bench_retrieval.py` | Retrieval performans testi | `python scripts/bench_retrieval.py` |
| `scripts/migrate_to_hybrid.py` | V04'ten V05'e migration | `python scripts/migrate_to_hybrid.py --dry-run` |

---

## 🔧 Sorun Giderme

### Backend Sorunları

```powershell
# Virtual environment sorunları
.\setup-backend.ps1 -Force

# Bağımlılık sorunları
.\setup-backend.ps1 -Clean

# Port kullanımda
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Veritabanı migration sorunları
cd backend
python -m alembic upgrade head
```

### Chat UI Sorunları

```powershell
# Node modules temizle
.\setup-chatui.ps1 -Force

# Manuel temizlik
cd chat-ui
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install

# Port kullanımda
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# Build sorunları
npm run check
npm run build
```

### Admin Panel Sorunları

```powershell
# Admin Panel yeniden kurulum
.\setup-admin.ps1 -Force

# Build sorunları
cd platform
npm run build
npm run preview

# API bağlantı sorunları
# .env dosyasını kontrol edin
# VITE_API_URL=http://localhost:8000
```

### MongoDB Sorunları

```powershell
# MongoDB'yi yeniden başlat
.\start-docker-mongodb.ps1 -Restart

# MongoDB durumunu kontrol et
.\start-docker-mongodb.ps1 -Status

# MongoDB loglarını görüntüle
docker-compose -f docker-compose.mongodb.yml logs -f

# MongoDB'yi tamamen temizle
.\setup-docker-mongodb.ps1 -Clean
docker-compose -f docker-compose.mongodb.yml down -v

# Yeniden kur
.\setup-docker-mongodb.ps1
.\start-docker-mongodb.ps1
```

### Vector Store Sorunları

```bash
# Chroma veritabanı bozuk
rm -rf backend/database/vector_store/chroma_db/*
# Dökümanları yeniden ingest edin

# FAISS index bozuk
python scripts/rebuild_faiss.py

# Embedding model indirme sorunları
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"

# Disk alanı yetersiz
du -sh backend/database/vector_store/*
# Eski dökümanları silin veya disk alanı açın
```

### Log Dosyaları

- **Backend**: `./backend/logs/` klasörü
- **MongoDB**: `docker-compose -f docker-compose.mongodb.yml logs`
- **Chat UI**: Terminal çıktısı
- **Admin Panel**: Browser console (F12)

---

## 📈 Performans ve Optimizasyon

### Backend Optimizasyon

- ✅ Lazy loading (models, indexes)
- ✅ Batch processing (32 texts)
- ✅ Redis caching
- ✅ GZip middleware
- ✅ Async routes
- ✅ Connection pooling

### Vector Store Optimizasyon

| Senaryo | Önerilen Yapı | Neden |
|---------|---------------|-------|
| **Küçük dataset (<1000 doc)** | Chroma only | FAISS overhead gereksiz |
| **Orta dataset (1K-10K doc)** | Hibrit (30/70) | İdeal denge |
| **Büyük dataset (>10K doc)** | Hibrit (20/80) | FAISS hızı kritik |
| **Sık metadata filter** | Chroma ağırlık artır | Chroma metadata güçlü |
| **Sadece hız** | FAISS only | Maksimum hız |

### Embedding Model Seçimi

| Kullanım | Model | Neden |
|----------|-------|-------|
| **Türkçe dökümanlar** | intfloat/multilingual-e5-base | TR desteği, dengeli |
| **İngilizce dökümanlar** | BAAI/bge-base-en-v1.5 | EN optimize |
| **Hız kritik** | all-MiniLM-L6-v2 | 384-dim, hızlı |
| **Kalite kritik** | intfloat/multilingual-e5-large | 1024-dim, yüksek kalite |

### Chunk Parametreleri

```env
# Teknik dökümanlar için (API docs, kod)
CHUNK_SIZE=500
CHUNK_OVERLAP=50

# Genel dökümanlar için (kitap, makale) - Varsayılan
CHUNK_SIZE=750
CHUNK_OVERLAP=100

# Uzun bağlam gerektiren (yasal, bilimsel)
CHUNK_SIZE=1000
CHUNK_OVERLAP=150
```

### Haftalık Bakım Önerileri

```bash
# Her Pazartesi sabahı
# 1. FAISS index rebuild
python scripts/rebuild_faiss.py

# 2. Vector store health check
curl http://localhost:8000/api/admin/vectorstore/health

# 3. Database backup
# SQLite
cp backend/rag_webui.db backend/backups/rag_webui_$(date +%Y%m%d).db
# MongoDB
docker exec ragleaf-mongodb mongodump --out=/data/backup

# 4. Disk alanı kontrolü
du -sh backend/database/vector_store/*

# 5. Log rotasyonu
find backend/logs/ -name "*.log" -mtime +30 -delete
```

---

## 🤝 Katkıda Bulunma

1. Projeyi fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

### Commit Mesajı Formatı

```
<type>: <description>

[optional body]
[optional footer]
```

**Types:**
- `feat`: Yeni özellik
- `fix`: Bug fix
- `docs`: Dokümantasyon
- `style`: Kod formatı
- `refactor`: Kod refactor
- `test`: Test ekleme
- `chore`: Build/config değişiklikleri

---

## 📞 Destek ve Dokümantasyon

- **Issues**: GitHub Issues kullanın
- **Dokümantasyon**: `/reports` klasörü
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Backend API**: http://localhost:8000/redoc (ReDoc)

---

## 📄 Lisans

Bu proje özel lisans altındadır. Daha fazla bilgi için lisans dosyasına bakın.

---

## 🎯 Örnek Kullanım Senaryoları

### Senaryo 1: Teknik Dokümantasyon RAG

```bash
# 1. Teknik dökümanları yükle
python scripts/ingest_path.py ./documents/technical_docs

# 2. Admin Panel'den model ayarları yap
# - Model: mistral-7b-instruct
# - Temperature: 0.3 (teknik cevaplar için düşük)
# - chunk_size: 500 (kod parçaları için küçük)

# 3. Chat UI'dan soru sor
# "API endpoint'i nasıl kullanırım?"
```

### Senaryo 2: Yasal Döküman Analizi

```bash
# 1. Yasal dökümanları yükle
python scripts/ingest_path.py ./documents/legal --extensions .pdf

# 2. Uzun chunk ayarları
# CHUNK_SIZE=1000
# CHUNK_OVERLAP=150

# 3. Reranking etkinleştir (hassasiyet için)
# enable_reranking: true

# 4. Soru sor
# "Sözleşmede ücret ödeme koşulları nelerdir?"
```

### Senaryo 3: Çoklu Dilde Müşteri Desteği

```bash
# 1. Türkçe + İngilizce dökümanları yükle
python scripts/ingest_path.py ./documents/support

# 2. Multilingual model kullan
# EMBEDDING_MODEL=intfloat/multilingual-e5-base

# 3. Chat mode ve RAG mode kombine kullan
# - Genel sorular: Chat mode
# - Spesifik prosedürler: RAG mode
```

---

> **Not**: Bu proje modern RAG teknolojisi ile Türkçe döküman işleme odaklı geliştirilmiştir. Hibrit Vector Store mimarisi (V05) ile hem hız hem de kalite optimize edilmiştir.

**Geliştirici**: Ragleaf AI Team
**Versiyon**: 5.0.0.1
**Son Güncelleme**: 2025-11-09
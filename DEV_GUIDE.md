# Ragleaf Geliştirme Rehberi

## Lokal Geliştirme Ortamı

### Backend Servisleri (Docker)

Backend servisleri Docker container'larında çalışır:

```bash
# Backend servislerini başlat
docker compose -f docker-compose.dev.yml up -d

# Servisleri durdur
docker compose -f docker-compose.dev.yml down

# Logları izle
docker compose -f docker-compose.dev.yml logs -f

# Servis durumunu kontrol et
docker compose -f docker-compose.dev.yml ps
```

**Backend Servisleri ve Portlar:**
- PostgreSQL: 1300
- Redis: 1303
- OCR Service: 1304
- Embedding Service: 1305
- API Gateway: 1306
- MinIO API: 1308
- MinIO Console: 1309

### Frontend Servisleri (Lokal)

Frontend servisleri lokal olarak npm run dev ile çalışır:

#### Platform (React/Vite)
```bash
cd platform
npm run dev
# http://localhost:5174
```

#### Landing (Next.js)
```bash
cd landing
npm run dev
# http://localhost:3000
```

### Ortam Değişkenleri

**Platform (.env.local):**
```
VITE_API_URL=http://localhost:1306
VITE_PUBLIC_API_URL=https://api.ragleaf.com
```

**Landing (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:1306
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Production Deploy

Tek komutla production deploy:

```bash
./deploy.sh
```

Bu betik:
1. Mevcut container'ları durdurur
2. Yeni imajları build eder
3. Tüm servisleri başlatır
4. Health check yapar
5. Servis durumunu gösterir

## Port Şeması

| Servis | Port | Açıklama |
|--------|------|----------|
| PostgreSQL | 1300 | Ana veritabanı (pgvector) |
| Landing Page | 1301 | Tanıtım sitesi (Docker) |
| Redis | 1303 | Cache ve kuyruk |
| OCR Service | 1304 | PDF/Text extraction |
| Embedding Service | 1305 | ML/Vector generation |
| API Gateway | 1306 | Main backend (FastAPI) |
| Platform | 1307 | Admin panel (Docker) |
| MinIO API | 1308 | S3-compatible storage |
| MinIO Console | 1309 | MinIO web interface |

**Lokal Dev Portları:**
- Platform: 5174
- Landing: 3000

## Servis Bağımlılıkları

```
API Gateway (1306)
├── PostgreSQL (1300)
├── Redis (1303)
├── OCR Service (1304) → Redis
├── Embedding Service (1305) → Redis
└── MinIO (1308/1309)

Platform (5174/1307)
└── API Gateway (1306)

Landing (3000/1301)
└── API Gateway (1306)
```

## Troubleshooting

### Backend Servisleri Başlamıyor

```bash
# Container loglarını kontrol et
docker compose -f docker-compose.dev.yml logs [service-name]

# Tüm logları gör
docker compose -f docker-compose.dev.yml logs

# Container'ları yeniden başlat
docker compose -f docker-compose.dev.yml restart
```

### Frontend Servisleri Başlamıyor

```bash
# Node modules silip yeniden yükle
cd platform
rm -rf node_modules package-lock.json
npm install

# Port çakışması kontrol et
lsof -i :5174  # Platform için
lsof -i :3000  # Landing için
```

### API Bağlantı Hataları

Frontend'in backend'e erişemediğinde:
1. Backend servislerinin çalıştığını kontrol et: `docker compose -f docker-compose.dev.yml ps`
2. API Gateway health check: `curl http://localhost:1306/health`
3. .env.local dosyalarının doğru olduğundan emin ol

### Docker Build Hataları

```bash
# Docker cache'i temizle
docker compose -f docker-compose.dev.yml build --no-cache

# Eski imajları temizle
docker system prune -a
```

## Geliştirme İpuçları

### Hot-Reload

- Backend: Docker volume mount sayesinde otomatik
- Platform: Vite HMR ile otomatik (50ms)
- Landing: Next.js Turbopack ile otomatik (384ms)

### Database Bağlantısı

```bash
# PostgreSQL'e bağlan
docker exec -it ragleaf_postgres_dev psql -U ragleaf -d ragleaf_db

# Redis'e bağlan
docker exec -it ragleaf_redis_dev redis-cli
```

### MinIO Console

MinIO web interface: http://localhost:1309
- User: ragleaf
- Password: ragleaf_minio_secret

## Yapılandırma Dosyaları

- `docker-compose.yml` - Production (tüm servisler)
- `docker-compose.dev.yml` - Development (sadece backend)
- `deploy.sh` - Production deploy betiği
- `.env` - Root environment variables
- `platform/.env.local` - Platform lokal config
- `landing/.env.local` - Landing lokal config

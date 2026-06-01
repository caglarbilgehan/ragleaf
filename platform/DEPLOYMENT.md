# Admin Panel Deployment Guide

## 🚀 Quick Deployment

### 1. Build the Project
```bash
# Run the deployment script
./deploy.ps1

# Or manually:
npm install
npm run build
```

### 2. Upload Files
Upload the contents of the `dist/` folder to your web server.

### 3. Server Configuration

#### Nginx Configuration
1. Copy `nginx.conf` to your nginx sites-available directory
2. Update SSL certificate paths
3. Update the document root path
4. Enable the site and reload nginx

#### Apache Configuration (.htaccess)
```apache
RewriteEngine On
RewriteBase /

# Handle Angular and Vue.js client-side routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# CORS Headers
Header always set Access-Control-Allow-Origin "https://api.ragleaf.com"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization"

# Security Headers
Header always set X-Frame-Options "SAMEORIGIN"
Header always set X-Content-Type-Options "nosniff"
Header always set X-XSS-Protection "1; mode=block"

# Cache Control
<filesMatch "\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
</filesMatch>

<filesMatch "\\.(html)$">
    ExpiresActive On
    ExpiresDefault "access plus 0 seconds"
</filesMatch>
```

## 🔧 Troubleshooting

### Common Issues

#### 1. 404 Errors for Chunk Files
**Problem**: `Failed to load resource: chunk-XXXXX.js 404`

**Solutions**:
- Ensure all files from `dist/assets/` are uploaded
- Check file permissions (755 for directories, 644 for files)
- Verify server configuration serves static files correctly
- Clear browser cache and CDN cache

#### 2. API Connection Issues
**Problem**: Cannot connect to backend API

**Solutions**:
- Verify `VITE_API_URL` in `.env.production`
- Check CORS configuration on backend server
- Ensure SSL certificates are valid
- Test API endpoints directly

#### 3. Routing Issues
**Problem**: Direct URL access returns 404

**Solutions**:
- Configure server to serve `index.html` for all routes
- Check nginx/apache configuration
- Verify `try_files` directive in nginx
- Ensure `.htaccess` is properly configured for Apache

#### 4. CORS Errors
**Problem**: Cross-origin requests blocked

**Solutions**:
- Configure CORS headers on web server
- Update backend CORS settings
- Check preflight OPTIONS requests
- Verify domain whitelist

### Build Issues

#### 1. TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix type errors before building
npm run lint
```

#### 2. Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### 3. Dependency Issues
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📊 Performance Optimization

### 1. Enable Gzip Compression
Ensure your web server compresses static assets:
- JavaScript files
- CSS files
- HTML files
- JSON responses

### 2. Set Cache Headers
Configure appropriate cache headers:
- Static assets: 1 year cache
- HTML files: No cache
- API responses: Appropriate cache based on content

### 3. Use CDN
Consider using a CDN for static assets to improve loading times globally.

## 🔒 Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS properly configured
- [ ] No sensitive data in client-side code
- [ ] Error pages don't expose system information
- [ ] File permissions properly set

## 📝 Environment Variables

### Production (.env.production)
```
VITE_API_URL=https://api.ragleaf.com
```

### Development (.env.development)
```
VITE_API_URL=http://localhost:8000
```

## 🚦 Health Check

After deployment, verify:

1. **Main page loads**: https://app.ragleaf.com/
2. **Login works**: Test with valid credentials
3. **API calls work**: Check network tab for successful requests
4. **Routing works**: Test direct URL access to different pages
5. **Assets load**: Verify all CSS, JS, and image files load correctly

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify network requests in developer tools
3. Check server logs for errors
4. Test API endpoints directly
5. Validate SSL certificate

## 🔄 Continuous Deployment

For automated deployment, consider:

1. **GitHub Actions**: Automate build and deployment
2. **Docker**: Containerize the application
3. **CI/CD Pipeline**: Integrate with your deployment pipeline

Example GitHub Action:
```yaml
name: Deploy Admin Panel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - name: Deploy to server
        # Add your deployment steps here
```

# 🚀 SiberNote LM - Activation Guide (First Deployment)

**Target:** Live deployment di VPS dalam 30-60 menit  
**Port Frontend:** 3000 (port 80 sudah terpakai)  
**Port Backend:** 8080 (private, di balik frontend)  
**Status:** Ready to launch

---

## ⚡ Quick Overview

Kamu akan:
1. Generate SSH key di VPS
2. Setup GitHub Secrets
3. Push ke main branch
4. GitHub Actions otomatis deploy
5. Verify services live

---

## 📋 Prerequisites Check

Pastikan VPS siap:

```bash
# SSH ke VPS
ssh your_user@123.45.67.89

# Verify installed
docker --version           # Docker ada
docker-compose --version   # Docker Compose ada
git --version              # Git ada
```

Jika belum ada, install:
```bash
curl -fsSL https://get.docker.com | sh
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

---

## 🔑 Step 1: Generate SSH Key (5 menit)

### di VPS

```bash
# SSH ke VPS sebagai deployment user
ssh deploy@123.45.67.89

# Generate SSH key (ed25519 = secure & compact)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

# Output private key (copy semuanya termasuk BEGIN/END)
cat ~/.ssh/id_ed25519
```

**Output akan seperti:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUtbm9uZQAAAABub25l...
(banyak baris)
-----END OPENSSH PRIVATE KEY-----
```

**Copy seluruh output ini untuk Step 2**

---

## 🔐 Step 2: Setup GitHub Secrets (10 menit)

### Buka GitHub

1. Go to repository: `https://github.com/yourorg/sibernote-lm`
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** untuk setiap secret berikut:

### Secret 1: VPS_HOST

```
Name:  VPS_HOST
Value: 123.45.67.89
(atau domain: api.yourdomain.com)
```

**Add secret** ✓

### Secret 2: VPS_USERNAME

```
Name:  VPS_USERNAME
Value: deploy
```

**Add secret** ✓

### Secret 3: VPS_SSH_KEY

```
Name:  VPS_SSH_KEY
Value: (paste entire private key dari Step 1)
```

**Harus include:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
...full key...
-----END OPENSSH PRIVATE KEY-----
```

**Add secret** ✓

### Secret 4: VPS_DEPLOY_PATH

```
Name:  VPS_DEPLOY_PATH
Value: /opt/sibernote
```

**Add secret** ✓

### Secret 5: UPLOADS_DIR (Optional tapi recommended)

```
Name:  UPLOADS_DIR
Value: /var/www/sibernote/uploads
```

**Add secret** ✓

### Secret 6: VITE_API_BASE_URL (Optional)

```
Name:  VITE_API_BASE_URL
Value: http://your-api-domain:8080
       (atau http://123.45.67.89:8080)
```

**Add secret** ✓

---

## 📁 Step 3: Prepare VPS (10-15 menit)

### SSH ke VPS

```bash
ssh deploy@123.45.67.89
```

### Create deployment directory

```bash
# Buat directory deployment
mkdir -p /opt/sibernote
cd /opt/sibernote

# Clone repository
git clone https://github.com/yourorg/sibernote-lm.git .

# Verify
ls -la
# Harus lihat: .github/, backend/, Frontend/, docker-compose.yml, etc.
```

### Setup .env file (PENTING!)

```bash
# Copy template
cp backend/.env.example backend/.env

# Edit .env dengan production values
nano backend/.env
```

**Edit ini di .env:**

```env
# Sesuaikan dengan production values kamu
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname?appName=...
PORT=8080
JWT_KEY=ganti_dengan_secret_kuat_minimal_32_karakter
REFRESH_TOKEN_KEY=ganti_dengan_secret_lain_minimal_32_karakter
UPLOAD_BASE_URL=http://123.45.67.89:8080/uploads
UPLOADS_DIR=/app/uploads
GEMINI_EMBEDDING_KEY=your_gemini_api_key
```

**Save:** `Ctrl+O` → `Enter` → `Ctrl+X`

### Verify file tersimpan

```bash
cat backend/.env | head -5
# Should output values yang kamu set
```

### Create uploads folder

```bash
# Create folder
mkdir -p /var/www/sibernote/uploads

# Set permissions (node user dalam container = UID 1000)
chmod 755 /var/www/sibernote/uploads

# Verify
ls -la /var/www/sibernote/
```

---

## 🌐 Step 4: Port Configuration (Port 3000)

### Frontend Port Configuration

Frontend sudah di-configure untuk port **3000**:

```yaml
# docker-compose.prod.yml
frontend:
  ports:
    - "3000:80"  # Expose port 80 dari container ke 3000 di host
```

### Access URLs

```
Frontend:  http://123.45.67.89:3000
Backend:   http://123.45.67.89:8080
API:       http://123.45.67.89:8080/api-docs (Swagger)
Health:    http://123.45.67.89:8080/health
```

### Optional: Setup Reverse Proxy (Nginx)

Jika mau hanya 1 port (port 80):

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/sibernote > /dev/null <<'EOF'
upstream backend {
    server 127.0.0.1:8080;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    # Frontend (root path)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable & restart
sudo ln -sf /etc/nginx/sites-available/sibernote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Then access di port 80:**
```
http://123.45.67.89/        # Frontend
http://123.45.67.89/api/    # Backend API
```

---

## ✅ Step 5: Verify VPS Preparation

Di VPS, verify semuanya:

```bash
# Check Docker
docker ps
docker-compose version

# Check deployment dir
cd /opt/sibernote
ls -la

# Check .env exists
cat backend/.env | grep MONGO_URL
# Should show: MONGO_URL=mongodb+srv://...

# Check uploads folder
ls -la /var/www/sibernote/uploads/

# Test git pull
git pull origin main
# Should show "Already up to date" atau latest commits
```

**All checks passed?** ✅ Lanjut ke Step 6

---

## 🚀 Step 6: Trigger First Deployment

### di Local Machine (laptop kamu)

```bash
# Clone repository locally (jika belum)
git clone https://github.com/yourorg/sibernote-lm.git
cd sibernote-lm

# Make small change untuk trigger
echo "# Deployment triggered" >> README.md

# Stage & commit
git add README.md
git commit -m "chore: trigger first CI/CD deployment"

# Push ke main
git push origin main
```

### Monitor Deployment

1. Go to: `https://github.com/yourorg/sibernote-lm/actions`
2. See workflow running: "CI/CD Pipeline for SiberNote LM"
3. Monitor stages:

```
⏳ ci        (2-3 min)  → Building backend/frontend
⏳ build     (5-10 min) → Creating Docker images
⏳ deploy    (3-5 min)  → Deploying to VPS
✅ Complete (in 10-20 min total)
```

**Click pada workflow untuk see logs real-time**

---

## 🔍 Step 7: Verify Live Deployment

### Check dari Local

```bash
# Test API health
curl http://123.45.67.89:8080/health
# Response: {"status":"healthy","timestamp":"...","uptime":...}

# Test Frontend
curl http://123.45.67.89:3000
# Response: HTML content dari React app

# Test API docs
curl http://123.45.67.89:8080/api-docs
# Response: Swagger UI (HTML)
```

### Check di VPS

```bash
# SSH ke VPS
ssh deploy@123.45.67.89
cd /opt/sibernote

# Check services running
docker-compose -f docker-compose.prod.yml ps
# Output:
# CONTAINER ID   IMAGE                    STATUS
# ...            sibernote-backend        Up (healthy)
# ...            sibernote-frontend       Up (healthy)

# Check logs (last 20 lines)
docker-compose -f docker-compose.prod.yml logs --tail 20 backend
docker-compose -f docker-compose.prod.yml logs --tail 20 frontend
```

### Access Frontend Browser

```
http://123.45.67.89:3000
```

Should see React app loading. Jika blank:
- Check browser console (F12) untuk errors
- Check backend logs: `docker-compose -f docker-compose.prod.yml logs -f backend`

---

## 🆘 Troubleshooting

### Issue 1: "Permission denied (publickey)"

**SSH key tidak bekerja**

```bash
# Verify SSH locally
ssh -i ~/.ssh/sibernote-deploy deploy@123.45.67.89 "echo OK"
# If fails, check VPS authorized_keys:

ssh deploy@123.45.67.89
stat ~/.ssh/authorized_keys
# Should show: 0600 (-rw-------)
```

### Issue 2: "docker: command not found"

**Docker tidak installed**

```bash
# Di VPS
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
# Log out & log in
exit
ssh deploy@123.45.67.89
```

### Issue 3: Deployment hangs / timeout

**Deploy step stuck**

```bash
# Cancel di GitHub Actions UI
# SSH ke VPS & check:
cd /opt/sibernote
docker-compose -f docker-compose.prod.yml logs -f backend
# Look for errors

# Manual retry:
git pull origin main
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Issue 4: Health check fails

**Services tidak healthy**

```bash
# Check backend connection to MongoDB
docker-compose -f docker-compose.prod.yml logs backend | grep -i mongo
# Should show: Connected to MongoDB

# Check frontend Nginx
docker-compose -f docker-compose.prod.yml logs frontend | grep -i error

# Manual health check
docker-compose -f docker-compose.prod.yml exec backend wget -qO- http://localhost:8080/health
# Should return: {"status":"healthy",...}
```

### Issue 5: Frontend stuck at 3000 port

**Port 3000 cannot access**

```bash
# Check port in use
ss -tlnp | grep 3000
# Should show: docker-proxy on port 3000

# Check firewall
sudo ufw allow 3000
# or
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

---

## 📊 Monitoring After Deploy

### Daily checks

```bash
# Health check
curl http://123.45.67.89:8080/health

# Check logs
ssh deploy@123.45.67.89
cd /opt/sibernote
docker-compose -f docker-compose.prod.yml logs --tail 50 backend
```

### If issues found

**For crashes:**
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Restart if needed
docker-compose -f docker-compose.prod.yml restart backend

# Check resource usage
docker stats
```

**For data issues:**
```bash
# Check uploads folder
du -sh /var/www/sibernote/uploads/

# Check MongoDB connection
docker-compose -f docker-compose.prod.yml exec backend \
  curl -s http://localhost:8080/health | grep -o '"status":"[^"]*"'
```

---

## 🔄 Automated Deployment After First Time

Setelah first deployment berhasil, setiap `git push origin main` akan:

1. ✅ Trigger GitHub Actions
2. ✅ Build & push Docker images
3. ✅ Auto-deploy ke VPS
4. ✅ Run health checks
5. ✅ Auto-rollback jika gagal
6. ✅ Notify status

**Zero effort deployment!**

---

## 🎯 Success Criteria

Deployment successful jika:

- [x] GitHub Actions workflow completed (green ✓)
- [x] Backend service healthy: `curl .../health` → `{"status":"healthy",...}`
- [x] Frontend loads: `curl http://123.45.67.89:3000` → HTML
- [x] API docs accessible: `http://123.45.67.89:8080/api-docs`
- [x] Logs show no errors: `docker-compose logs backend`
- [x] Both containers running: `docker-compose ps`

**All criteria met?** 🎉 **You're LIVE!**

---

## 📞 Next Steps

### Immediately
- [ ] Monitor logs for 1 hour (ensure stability)
- [ ] Test API endpoints manually
- [ ] Check file uploads work
- [ ] Verify database connection

### Next 24 hours
- [ ] Test rollback (push bad code, verify auto-rollback)
- [ ] Check monitoring/logging setup
- [ ] Verify backup procedures

### Next week
- [ ] Setup SSL/HTTPS (Let's Encrypt)
- [ ] Configure reverse proxy (Nginx for port 80)
- [ ] Setup monitoring alerts
- [ ] Test multi-user scenarios

---

## 📚 Documentation Reference

| Need | See |
|---|---|
| Full guide | `docs/CI-CD.md` |
| Secrets setup details | `docs/GITHUB-SECRETS-SETUP.md` |
| Troubleshooting | `docs/CI-CD.md` → Troubleshooting |
| VPS uploads setup | `backend/VPS_UPLOAD_SETUP.md` |
| Implementation report | `CI-CD-IMPLEMENTATION-REPORT.md` |

---

## ⏱️ Timeline

```
Step 1: SSH Key gen      (5 min)
Step 2: GitHub Secrets   (10 min)
Step 3: VPS Setup        (15 min)
Step 4: Port Config      (5 min)
Step 5: Verify VPS       (5 min)
Step 6: Trigger Deploy   (2 min)
Step 7: Monitor Deploy   (10-20 min)  ← wait for CI/CD
Step 8: Verify Live      (5 min)
───────────────────────────────────
Total: 60-75 minutes

🎉 You're LIVE!
```

---

## 🆘 Emergency Contacts

Jika stuck:

1. **Check logs:** `docs/CI-CD.md` → Troubleshooting
2. **Check secrets:** `docs/GITHUB-SECRETS-SETUP.md`
3. **Check VPS:** SSH & run verify commands above
4. **Manual rollback:** `docs/CI-CD.md` → Rollback Procedure

---

**Ready?** Mulai dari Step 1! 🚀

---

**Document:** Activation Guide  
**Version:** 1.0.0  
**Date:** November 2024  
**Status:** Ready for first deployment

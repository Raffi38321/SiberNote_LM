# SSH Key Setup Guide - SiberNote LM Deployment

Panduan detail untuk generate & setup SSH key untuk GitHub Actions deployment.

---

## 📋 Overview

GitHub Actions perlu SSH key untuk connect ke VPS dan deploy. Kita akan:

1. **Generate SSH key di VPS** (ed25519 format - secure & compact)
2. **Copy private key** → GitHub Secrets
3. **Verify setup** → Test connection

---

## 🔑 Method 1: Generate on VPS (Recommended)

### Step 1: SSH ke VPS

```bash
# Connect sebagai deployment user
ssh deploy@123.45.67.89
# atau
ssh -i ~/.ssh/your_key deploy@your-vps-ip
```

### Step 2: Generate SSH Key

```bash
# Generate ed25519 key (most secure)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

# Output:
# Generating public/private ed25519 key pair.
# Your identification has been saved in /home/deploy/.ssh/id_ed25519
# Your public key has been saved in /home/deploy/.ssh/id_ed25519.pub
# The key fingerprint is:
# SHA256:abc123... deploy@vps
```

**Parameters explained:**
- `-t ed25519` = elliptic curve algorithm (modern, secure)
- `-f ~/.ssh/id_ed25519` = save to this file
- `-N ""` = no passphrase (needed for CI/CD automation)

### Step 3: Verify Key Generated

```bash
# List SSH keys
ls -la ~/.ssh/

# Output should show:
# -rw------- id_ed25519       (private key)
# -rw-r--r-- id_ed25519.pub   (public key)
```

### Step 4: Display Private Key

```bash
# Show private key (untuk copy ke GitHub)
cat ~/.ssh/id_ed25519

# Output akan seperti:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUtbm9uZQAAAABub25lAAAAC2FlcyEyNS1jdHI=
Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4Q3Q4
... (panjang ~100 baris) ...
-----END OPENSSH PRIVATE KEY-----
```

### Step 5: Copy Entire Private Key

```bash
# Copy ke clipboard (macOS)
cat ~/.ssh/id_ed25519 | pbcopy

# Copy ke clipboard (Linux)
cat ~/.ssh/id_ed25519 | xclip -selection clipboard

# Or manually select & copy
cat ~/.ssh/id_ed25519
# Highlight semua (Ctrl+A), copy (Ctrl+C)
```

**⚠️ Important:**
- Copy **SEMUA** termasuk `-----BEGIN` dan `-----END`
- Jangan ada baris tambahan
- Maintain formatting (newlines intact)

---

## 🔐 Method 2: Generate on Local Machine (Alternative)

Jika prefer generate di laptop kamu:

### Step 1: Generate Locally

```bash
# Generate di local machine
ssh-keygen -t ed25519 -f ~/.ssh/sibernote-deploy -N ""

# Output:
# Generating public/private ed25519 key pair.
# Your identification has been saved in /home/user/.ssh/sibernote-deploy
# Your public key has been saved in /home/user/.ssh/sibernote-deploy.pub
```

### Step 2: Copy Public Key to VPS

```bash
# Add public key ke VPS authorized_keys
ssh-copy-id -i ~/.ssh/sibernote-deploy.pub deploy@123.45.67.89

# Output:
# Number of key(s) added: 1
# Now try logging in with:
# ssh -i ~/.ssh/sibernote-deploy.pub deploy@123.45.67.89
```

### Step 3: Verify SSH Connection

```bash
# Test SSH dengan new key
ssh -i ~/.ssh/sibernote-deploy deploy@123.45.67.89 "echo Success"

# Output: Success
```

### Step 4: Copy Private Key for GitHub

```bash
# Display private key
cat ~/.ssh/sibernote-deploy

# Copy seluruhnya untuk GitHub Secrets
```

---

## 🔒 Security Best Practices

### Key Format Options

| Type | Security | Size | Speed | Notes |
|---|---|---|---|---|
| **ed25519** | ⭐⭐⭐⭐⭐ | Small | Fast | 🟢 Recommended |
| **RSA 4096** | ⭐⭐⭐⭐ | Medium | Slow | Older but solid |
| **RSA 2048** | ⭐⭐⭐ | Small | Fast | Not recommended |
| **ECDSA** | ⭐⭐⭐⭐ | Small | Fast | Good alternative |

**⚠️ Use ed25519!**

### Passphrase Setting

```bash
# With passphrase (manual - can't use in CI/CD)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
# Prompted for passphrase

# Without passphrase (automated - for CI/CD)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
# No prompt, ready for automation
```

**For GitHub Actions:** `-N ""` (no passphrase)

### Permissions

Verify permissions correct:

```bash
# Check key permissions
ls -la ~/.ssh/id_ed25519

# Should show: -rw------- (600)
# If not, fix:
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub

# Check authorized_keys
ls -la ~/.ssh/authorized_keys
# Should show: -rw------- (600)
# If not, fix:
chmod 600 ~/.ssh/authorized_keys
```

### Backup Private Key

```bash
# IMPORTANT: Backup private key securely
cp ~/.ssh/id_ed25519 ~/backup/sibernote-deploy-key.backup

# Keep in secure location (NOT in repo)
# Encrypt if possible:
gpg --encrypt -r your@email.com ~/backup/sibernote-deploy-key.backup
```

---

## ✅ Verification Steps

### Verify Key Quality

```bash
# Show key fingerprint
ssh-keygen -lf ~/.ssh/id_ed25519

# Output:
# 256 SHA256:abc123... user@host (ED25519)

# Show public key format
cat ~/.ssh/id_ed25519.pub
# Should start with: ssh-ed25519 AAAA...
```

### Test SSH Connection

```bash
# Test manual SSH
ssh -i ~/.ssh/id_ed25519 deploy@123.45.67.89 "echo Test OK"

# Output: Test OK

# Test specific port (if using non-standard)
ssh -i ~/.ssh/id_ed25519 -p 2222 deploy@123.45.67.89 "echo Test OK"
```

### Verify Public Key on VPS

```bash
# SSH ke VPS
ssh deploy@123.45.67.89

# Check authorized_keys
cat ~/.ssh/authorized_keys
# Should contain your public key line
```

---

## 📤 Adding to GitHub Secrets

### Step 1: Prepare Key Content

```bash
# Copy private key to clipboard
cat ~/.ssh/id_ed25519 | pbcopy  # macOS
# or
cat ~/.ssh/id_ed25519 | xclip -selection clipboard  # Linux
# or
cat ~/.ssh/id_ed25519 | wl-copy  # Wayland
```

### Step 2: Go to GitHub

1. Repository → **Settings**
2. → **Secrets and variables**
3. → **Actions**
4. → **New repository secret**

### Step 3: Add Secret

```
Name:  VPS_SSH_KEY

Value: (paste entire private key here)
       Must include:
       -----BEGIN OPENSSH PRIVATE KEY-----
       ...full content...
       -----END OPENSSH PRIVATE KEY-----
```

### Step 4: Verify Added

```
GitHub Secrets should show:
├─ VPS_SSH_KEY ●●●●●●●●●
```

(Dots indicate encrypted secret)

---

## 🆘 Troubleshooting

### Issue 1: "Permission denied (publickey)"

**SSH key not working**

```bash
# Verify key exists on VPS
ssh deploy@123.45.67.89 "ls -la ~/.ssh/"
# Should show: id_ed25519, id_ed25519.pub, authorized_keys

# Verify public key in authorized_keys
ssh deploy@123.45.67.89 "cat ~/.ssh/authorized_keys"
# Should show your public key

# Verify permissions
ssh deploy@123.45.67.89 "stat ~/.ssh/authorized_keys"
# Should show: 0600 (-rw-------)
# Fix if needed:
ssh deploy@123.45.67.89 "chmod 600 ~/.ssh/authorized_keys"
```

### Issue 2: "Too many authentication failures"

**Wrong key or too many keys**

```bash
# Clear SSH key cache
ssh-add -D

# Add correct key specifically
ssh-add ~/.ssh/id_ed25519

# Test again
ssh deploy@123.45.67.89 "echo OK"
```

### Issue 3: GitHub Actions "Connection refused"

**VPS not accepting SSH**

```bash
# Verify SSH running on VPS
ssh deploy@123.45.67.89 "sudo service ssh status"
# Should show: active (running)

# Check SSH listening
ssh deploy@123.45.67.89 "sudo ss -tlnp | grep :22"
# Should show: 0.0.0.0:22 (or ::1:22)

# Verify firewall allows SSH
ssh deploy@123.45.67.89 "sudo ufw status"
# Should show: 22/tcp ALLOW
# If not:
ssh deploy@123.45.67.89 "sudo ufw allow 22"
```

### Issue 4: Key format wrong in GitHub

**GitHub doesn't recognize key**

```bash
# Verify key format
head -1 ~/.ssh/id_ed25519
# Should show: -----BEGIN OPENSSH PRIVATE KEY-----

# NOT this (PEM format):
# -----BEGIN RSA PRIVATE KEY-----
# -----BEGIN EC PRIVATE KEY-----

# Convert if needed (but ed25519 shouldn't need conversion)
```

### Issue 5: Newlines messed up in GitHub Secrets

**Key not working because of formatting**

```bash
# When copying to GitHub:
# 1. Verify newlines intact (line breaks preserved)
# 2. No extra spaces at beginning/end
# 3. Entire key pasted (BEGIN to END)

# If pasted wrong:
# 1. Delete secret in GitHub
# 2. Copy again carefully
# 3. Paste in new secret
# 4. Re-add to CI/CD
```

---

## 🔄 Rotating SSH Key

### When to Rotate

- [ ] Every 6 months (security)
- [ ] Immediately if compromised
- [ ] When employee leaves
- [ ] Before major deployment

### How to Rotate

```bash
# 1. Generate new key on VPS
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_new -N ""

# 2. Add new key to authorized_keys
cat ~/.ssh/id_ed25519_new.pub >> ~/.ssh/authorized_keys

# 3. Verify both keys work
ssh -i ~/.ssh/id_ed25519_new deploy@localhost "echo OK"
ssh -i ~/.ssh/id_ed25519 deploy@localhost "echo OK"

# 4. Update GitHub Secret with new key
# GitHub → Settings → Secrets → VPS_SSH_KEY → Update

# 5. Test GitHub Actions deployment with new key

# 6. Remove old key from authorized_keys
# Edit ~/.ssh/authorized_keys and remove old key line

# 7. Verify old key doesn't work
# (shouldn't be able to login with old key anymore)
```

---

## 📊 Key Comparison

### ed25519 vs RSA

```
┌─────────────────────────────────────────┐
│ ed25519 (Recommended)                   │
├─────────────────────────────────────────┤
│ ✅ Modern algorithm                     │
│ ✅ Smaller key size (256 bits)          │
│ ✅ Faster operations                    │
│ ✅ Better security                      │
│ ✅ No SHA-1 weaknesses                  │
│ ✅ Future-proof                         │
│ ❌ Less legacy support (rare)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ RSA 4096 (Alternative)                  │
├─────────────────────────────────────────┤
│ ✅ Widely compatible                    │
│ ✅ Well-tested                          │
│ ✅ Strong (4096 bits)                   │
│ ❌ Larger key size                      │
│ ❌ Slower operations                    │
│ ❌ Requires longer key length           │
└─────────────────────────────────────────┘
```

**Use ed25519 for new deployments!**

---

## 🎯 Quick Checklist

- [ ] SSH key generated on VPS (ed25519)
- [ ] Private key copied to clipboard
- [ ] GitHub Secret VPS_SSH_KEY created
- [ ] SSH connection tested locally
- [ ] Permissions verified (600 on private key)
- [ ] Public key in authorized_keys on VPS
- [ ] GitHub Actions workflow can reference the secret
- [ ] Test deployment runs successfully

All checked? ✅ Ready for deployment!

---

## 📚 Related Documentation

- **Activation Guide:** `ACTIVATION-GUIDE.md`
- **GitHub Secrets Setup:** `docs/GITHUB-SECRETS-SETUP.md`
- **CI/CD Complete Guide:** `docs/CI-CD.md`
- **Troubleshooting:** `docs/CI-CD.md` → Troubleshooting

---

**Document:** SSH Key Setup Guide  
**Version:** 1.0.0  
**Date:** November 2024  
**Status:** Ready for production

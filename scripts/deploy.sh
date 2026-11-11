#!/bin/bash

################################################################################
# SiberNote LM - VPS Deployment Script
#
# Dijalankan oleh GitHub Actions untuk deploy ke VPS via SSH
# Atau dapat dijalankan manual di VPS untuk deployment lokal
#
# Usage:
#   ./deploy.sh                           # Interactive mode
#   ./deploy.sh <image-tag>              # Automatic mode
#
# Environment Variables (untuk CI/CD):
#   GHCR_REGISTRY      - GitHub Container Registry base URL
#   IMAGE_TAG          - Image tag (e.g., main-abc123)
#   UPLOADS_DIR        - Path to uploads directory
#   GITHUB_ACTOR       - GitHub username (untuk login GHCR)
#   GITHUB_TOKEN       - GitHub token untuk login GHCR
#
################################################################################

set -e

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
GHCR_REGISTRY="${GHCR_REGISTRY:-ghcr.io/yourorg}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/www/sibernote/uploads}"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_DIR="/tmp/sibernote-deployment"
BACKUP_DIR="${LOG_DIR}/backups"
DEPLOYMENT_LOG="${LOG_DIR}/deployment-$(date +%Y%m%d-%H%M%S).log"

# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────────────────────

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo "[ERROR] $1" | tee -a "$DEPLOYMENT_LOG" >&2
}

success() {
    echo "[SUCCESS] $1" | tee -a "$DEPLOYMENT_LOG"
}

info() {
    echo "[INFO] $1" | tee -a "$DEPLOYMENT_LOG"
}

setup_logging() {
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    log "Deployment log: $DEPLOYMENT_LOG"
}

check_dependencies() {
    log "Checking dependencies..."
    
    local deps=("docker" "docker-compose" "git" "wget")
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is not installed"
            return 1
        fi
    done
    
    success "All dependencies available"
}

# ──────────────────────────────────────────────────────────────────────────────
# Backup & Rollback
# ──────────────────────────────────────────────────────────────────────────────

backup_current_deployment() {
    log "Creating backup of current deployment..."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        info "No existing deployment to backup"
        return 0
    fi
    
    local backup_file="$BACKUP_DIR/docker-compose-$(date +%Y%m%d-%H%M%S).yml"
    cp "$COMPOSE_FILE" "$backup_file"
    
    # Save current image info
    if docker-compose -f "$COMPOSE_FILE" ps 2>/dev/null | grep -q "sibernote-backend"; then
        docker-compose -f "$COMPOSE_FILE" ps > "$BACKUP_DIR/containers-before.log"
        docker images | grep sibernote >> "$BACKUP_DIR/images-before.log" || true
    fi
    
    success "Backup created at $backup_file"
}

rollback() {
    error "Deployment failed. Attempting rollback..."
    
    local latest_backup=$(find "$BACKUP_DIR" -name "docker-compose-*.yml" -type f | sort -r | head -1)
    
    if [ -z "$latest_backup" ]; then
        error "No backup found for rollback"
        return 1
    fi
    
    log "Rolling back to: $latest_backup"
    cp "$latest_backup" "$COMPOSE_FILE"
    
    if docker-compose -f "$COMPOSE_FILE" up -d --no-build 2>/dev/null; then
        success "Rollback completed"
        return 0
    else
        error "Rollback failed"
        return 1
    fi
}

# ──────────────────────────────────────────────────────────────────────────────
# Docker Setup
# ──────────────────────────────────────────────────────────────────────────────

docker_login() {
    log "Logging in to GitHub Container Registry..."
    
    if [ -z "${GITHUB_TOKEN}" ] && [ -z "${GITHUB_ACTOR}" ]; then
        info "Skipping GHCR login (no credentials provided)"
        return 0
    fi
    
    local token="${GITHUB_TOKEN:-}"
    if [ -z "$token" ]; then
        info "GITHUB_TOKEN not set, attempting login with GitHub CLI..."
        if command -v gh &> /dev/null && gh auth status &>/dev/null; then
            token=$(gh auth token)
        else
            error "No valid authentication for GHCR"
            return 1
        fi
    fi
    
    echo "$token" | docker login -u "${GITHUB_ACTOR:-github-user}" --password-stdin ghcr.io
    success "GHCR login successful"
}

docker_pull_images() {
    log "Pulling Docker images..."
    
    local backend_image="${GHCR_REGISTRY}/sibernote-backend:${IMAGE_TAG}"
    local frontend_image="${GHCR_REGISTRY}/sibernote-frontend:${IMAGE_TAG}"
    
    if ! docker pull "$backend_image" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        error "Failed to pull backend image: $backend_image"
        return 1
    fi
    
    if ! docker pull "$frontend_image" 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        error "Failed to pull frontend image: $frontend_image"
        return 1
    fi
    
    success "Images pulled successfully"
}

# ──────────────────────────────────────────────────────────────────────────────
# Deployment
# ──────────────────────────────────────────────────────────────────────────────

prepare_uploads_dir() {
    log "Preparing uploads directory: $UPLOADS_DIR"
    
    if [ ! -d "$UPLOADS_DIR" ]; then
        mkdir -p "$UPLOADS_DIR"
    fi
    
    # Set proper permissions
    chmod 755 "$UPLOADS_DIR"
    
    success "Uploads directory ready"
}

deploy() {
    log "Starting deployment..."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "docker-compose.prod.yml not found in current directory"
        return 1
    fi
    
    # Set environment variables untuk compose
    export GHCR_REGISTRY
    export IMAGE_TAG
    export UPLOADS_DIR
    
    log "Pulling services with docker-compose..."
    if ! docker-compose -f "$COMPOSE_FILE" pull 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        error "Failed to pull services"
        return 1
    fi
    
    log "Bringing up services..."
    if ! docker-compose -f "$COMPOSE_FILE" up -d --no-build 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
        error "Failed to start services"
        return 1
    fi
    
    success "Services started"
}

# ──────────────────────────────────────────────────────────────────────────────
# Health Checks
# ──────────────────────────────────────────────────────────────────────────────

wait_for_services() {
    log "Waiting for services to stabilize..."
    sleep 5
}

health_check() {
    log "Running health checks..."
    
    local retries=5
    local interval=5
    local backend_healthy=false
    local frontend_healthy=false
    
    # Check backend
    for ((i = 1; i <= retries; i++)); do
        log "Backend health check attempt $i/$retries"
        if docker-compose -f "$COMPOSE_FILE" exec -T backend wget -qO- http://localhost:8080/health 2>/dev/null | grep -q "healthy"; then
            success "Backend is healthy"
            backend_healthy=true
            break
        fi
        
        if [ $i -lt $retries ]; then
            sleep $interval
        fi
    done
    
    # Check frontend
    for ((i = 1; i <= retries; i++)); do
        log "Frontend health check attempt $i/$retries"
        if docker-compose -f "$COMPOSE_FILE" exec -T frontend wget -qO- http://localhost:80/ > /dev/null 2>&1; then
            success "Frontend is healthy"
            frontend_healthy=true
            break
        fi
        
        if [ $i -lt $retries ]; then
            sleep $interval
        fi
    done
    
    if ! $backend_healthy || ! $frontend_healthy; then
        error "Health check failed"
        error "Backend: $backend_healthy, Frontend: $frontend_healthy"
        return 1
    fi
    
    success "All health checks passed"
}

show_status() {
    log "Current deployment status:"
    docker-compose -f "$COMPOSE_FILE" ps | tee -a "$DEPLOYMENT_LOG"
    
    info "Image information:"
    docker images | grep sibernote | tee -a "$DEPLOYMENT_LOG" || true
}

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

main() {
    setup_logging
    
    log "╔════════════════════════════════════════════════════════════════╗"
    log "║       SiberNote LM - Deployment Script                        ║"
    log "╚════════════════════════════════════════════════════════════════╝"
    
    # Parse arguments
    if [ -n "$1" ]; then
        IMAGE_TAG="$1"
    fi
    
    log "Configuration:"
    log "  Registry: $GHCR_REGISTRY"
    log "  Image Tag: $IMAGE_TAG"
    log "  Uploads Dir: $UPLOADS_DIR"
    log "  Compose File: $COMPOSE_FILE"
    
    # Run deployment steps
    check_dependencies || exit 1
    backup_current_deployment || exit 1
    docker_login || exit 1
    docker_pull_images || exit 1
    prepare_uploads_dir || exit 1
    
    if ! deploy; then
        error "Deployment failed"
        rollback || error "Rollback also failed"
        exit 1
    fi
    
    wait_for_services
    
    if ! health_check; then
        error "Health check failed, rolling back..."
        rollback || error "Rollback failed"
        exit 1
    fi
    
    show_status
    
    log "╔════════════════════════════════════════════════════════════════╗"
    log "║           Deployment Completed Successfully! ✓                 ║"
    log "╚════════════════════════════════════════════════════════════════╝"
    log "Log file: $DEPLOYMENT_LOG"
}

# Handle errors
trap 'error "Script interrupted"; exit 130' INT TERM

main "$@"

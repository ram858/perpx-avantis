#!/bin/bash
# Complete Database Cluster Deployment Script for PrepX
# This script deploys the entire database architecture for millions of users

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
    fi
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local deps=("docker" "docker-compose" "jq" "psql" "pg_isready")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error "Missing dependencies: ${missing_deps[*]}"
    fi
    
    success "All dependencies are available"
}

# Check if Docker is running
check_docker() {
    log "Checking Docker daemon..."
    
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running"
    fi
    
    success "Docker daemon is running"
}

# Generate environment file if it doesn't exist
generate_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log "Generating environment file..."
        
        cat > "$ENV_FILE" << EOF
# PrepX Database Configuration
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_REPLICATION_PASSWORD=$(openssl rand -base64 32)
PGBOUNCER_CONSOLE_PASSWORD=$(openssl rand -base64 16)
JWT_SECRET=$(openssl rand -base64 64)
SMTP_PASSWORD=your_smtp_password_here
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
THANOS_PASSWORD=your_thanos_password_here
GRAFANA_PASSWORD=$(openssl rand -base64 16)
INFLUXDB_PASSWORD=$(openssl rand -base64 32)
INFLUXDB_TOKEN=$(openssl rand -base64 64)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Database URLs
DATABASE_URL=postgresql://postgres:\${POSTGRES_PASSWORD}@postgres-primary:5432/prepx
DATABASE_READONLY_URL=postgresql://postgres:\${POSTGRES_PASSWORD}@postgres-replica-us-west:5432/prepx
PGBOUNCER_URL=postgresql://postgres:\${POSTGRES_PASSWORD}@pgbouncer:6432/prepx
REDIS_URL=redis://:\${REDIS_PASSWORD}@redis-master:6379

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
ALERTMANAGER_URL=http://alertmanager:9093

# Failover Configuration
PRIMARY_HOST=postgres-primary
STANDBY_1_HOST=postgres-standby-1
STANDBY_2_HOST=postgres-standby-2
MONITORING_INTERVAL=30
FAILOVER_THRESHOLD=3
EOF
        
        success "Environment file generated: $ENV_FILE"
        warning "Please review and update the environment file with your specific values"
    else
        log "Environment file already exists: $ENV_FILE"
    fi
}

# Create SSL certificates
create_ssl_certificates() {
    log "Creating SSL certificates..."
    
    local ssl_dir="$SCRIPT_DIR/ssl"
    mkdir -p "$ssl_dir"
    
    if [[ ! -f "$ssl_dir/server.crt" ]]; then
        # Generate self-signed certificate for development
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$ssl_dir/server.key" \
            -out "$ssl_dir/server.crt" \
            -subj "/C=US/ST=CA/L=San Francisco/O=PrepX/CN=localhost"
        
        # Copy to client certificate (same for simplicity)
        cp "$ssl_dir/server.crt" "$ssl_dir/client.crt"
        cp "$ssl_dir/server.key" "$ssl_dir/client.key"
        
        success "SSL certificates created"
    else
        log "SSL certificates already exist"
    fi
}

# Create monitoring directories
create_monitoring_directories() {
    log "Creating monitoring directories..."
    
    mkdir -p "$SCRIPT_DIR/monitoring/grafana/dashboards"
    mkdir -p "$SCRIPT_DIR/monitoring/grafana/provisioning/dashboards"
    mkdir -p "$SCRIPT_DIR/monitoring/grafana/provisioning/datasources"
    mkdir -p "$SCRIPT_DIR/monitoring/alertmanager"
    mkdir -p "$SCRIPT_DIR/logs"
    
    success "Monitoring directories created"
}

# Deploy database cluster
deploy_database_cluster() {
    log "Deploying database cluster..."
    
    cd "$SCRIPT_DIR"
    
    # Start with basic replication setup
    log "Starting PostgreSQL master-slave replication..."
    docker-compose -f multi-region-setup.yml up -d postgres-primary-us-east postgres-replica-us-west
    
    # Wait for primary to be ready
    log "Waiting for primary database to be ready..."
    local max_wait=60
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
            break
        fi
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        error "Primary database failed to start within $max_wait seconds"
    fi
    
    success "Primary database is ready"
    
    # Start additional replicas
    log "Starting additional read replicas..."
    docker-compose -f multi-region-setup.yml up -d postgres-replica-eu-west postgres-replica-ap-southeast postgres-replica-eu-central
    
    # Start PgBouncer
    log "Starting PgBouncer connection poolers..."
    docker-compose -f multi-region-setup.yml up -d postgres-proxy postgres-readonly-proxy
    
    success "Database cluster deployed successfully"
}

# Deploy sharded setup (optional)
deploy_sharded_setup() {
    local deploy_shards="${1:-false}"
    
    if [[ "$deploy_shards" == "true" ]]; then
        log "Deploying sharded database setup..."
        
        cd "$SCRIPT_DIR"
        docker-compose -f shard-docker-compose.yml up -d
        
        success "Sharded database setup deployed"
    else
        log "Skipping sharded setup (use --shards flag to enable)"
    fi
}

# Deploy failover setup
deploy_failover_setup() {
    local deploy_failover="${1:-true}"
    
    if [[ "$deploy_failover" == "true" ]]; then
        log "Deploying failover setup..."
        
        cd "$SCRIPT_DIR"
        docker-compose -f failover-setup.yml up -d
        
        success "Failover setup deployed"
    else
        log "Skipping failover setup"
    fi
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    cd "$SCRIPT_DIR"
    docker-compose -f multi-region-setup.yml up -d prometheus grafana
    
    success "Monitoring stack deployed"
}

# Initialize databases
initialize_databases() {
    log "Initializing databases..."
    
    # Wait for databases to be ready
    sleep 30
    
    # Run initialization scripts
    local scripts=(
        "setup-replication.sql"
        "optimize-indexes.sql"
        "setup-sharding.sql"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -f "$SCRIPT_DIR/$script" ]]; then
            log "Running $script..."
            docker exec -i postgres-primary-us-east psql -U postgres -d prepx < "$SCRIPT_DIR/$script" || warning "Failed to run $script"
        fi
    done
    
    success "Database initialization completed"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    local checks=(
        "pg_isready -h localhost -p 5432 -U postgres"
        "pg_isready -h localhost -p 5433 -U postgres"
        "docker exec pgbouncer psql -h localhost -p 6432 -U postgres -d prepx -c 'SELECT 1'"
    )
    
    for check in "${checks[@]}"; do
        if eval "$check" >/dev/null 2>&1; then
            success "Health check passed: $check"
        else
            warning "Health check failed: $check"
        fi
    done
}

# Display cluster status
display_cluster_status() {
    log "Displaying cluster status..."
    
    echo ""
    echo "=========================================="
    echo "PrepX Database Cluster Status"
    echo "=========================================="
    echo ""
    
    # Database status
    echo "Database Services:"
    docker-compose -f multi-region-setup.yml ps | grep -E "(postgres|pgbouncer)" || true
    
    echo ""
    echo "Connection Information:"
    echo "- Primary Database: localhost:5432"
    echo "- Read Replicas: localhost:5433"
    echo "- PgBouncer (Write): localhost:6432"
    echo "- PgBouncer (Read): localhost:6433"
    echo ""
    
    echo "Monitoring:"
    echo "- Prometheus: http://localhost:9090"
    echo "- Grafana: http://localhost:3000 (admin/admin)"
    echo "- HAProxy Stats: http://localhost:8404/stats (admin/admin123)"
    echo ""
    
    echo "Health Check Commands:"
    echo "- Primary: pg_isready -h localhost -p 5432 -U postgres"
    echo "- Replica: pg_isready -h localhost -p 5433 -U postgres"
    echo "- PgBouncer: psql -h localhost -p 6432 -U postgres -d prepx"
    echo ""
}

# Cleanup function
cleanup() {
    log "Cleaning up on exit..."
    # Add any cleanup tasks here
}

# Main function
main() {
    local deploy_shards="false"
    local deploy_failover="true"
    local skip_monitoring="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --shards)
                deploy_shards="true"
                shift
                ;;
            --no-failover)
                deploy_failover="false"
                shift
                ;;
            --skip-monitoring)
                skip_monitoring="true"
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --shards           Deploy sharded database setup"
                echo "  --no-failover      Skip failover setup"
                echo "  --skip-monitoring  Skip monitoring stack deployment"
                echo "  --help             Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    log "Starting PrepX Database Cluster Deployment"
    log "Configuration: Shards=$deploy_shards, Failover=$deploy_failover, Monitoring=$([ "$skip_monitoring" == "true" ] && echo "false" || echo "true")"
    
    # Pre-deployment checks
    check_root
    check_dependencies
    check_docker
    
    # Setup
    generate_env_file
    create_ssl_certificates
    create_monitoring_directories
    
    # Deployment
    deploy_database_cluster
    deploy_sharded_setup "$deploy_shards"
    deploy_failover_setup "$deploy_failover"
    
    if [[ "$skip_monitoring" != "true" ]]; then
        deploy_monitoring
    fi
    
    # Post-deployment
    initialize_databases
    run_health_checks
    display_cluster_status
    
    success "PrepX Database Cluster deployment completed successfully!"
    log "Next steps:"
    log "1. Review the environment file: $ENV_FILE"
    log "2. Configure your application to use the database URLs"
    log "3. Set up monitoring dashboards in Grafana"
    log "4. Configure alerting rules in AlertManager"
    log "5. Test failover scenarios"
}

# Run main function
main "$@"

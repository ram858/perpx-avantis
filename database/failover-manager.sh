#!/bin/bash
# Failover Manager for PrepX Database Cluster
# Monitors database health and handles automatic failover

set -euo pipefail

# Configuration
PRIMARY_HOST=${PRIMARY_HOST:-"postgres-primary"}
STANDBY_1_HOST=${STANDBY_1_HOST:-"postgres-standby-1"}
STANDBY_2_HOST=${STANDBY_2_HOST:-"postgres-standby-2"}
MONITORING_INTERVAL=${MONITORING_INTERVAL:-30}
FAILOVER_THRESHOLD=${FAILOVER_THRESHOLD:-3}
LOG_FILE="/var/log/failover/failover.log"
STATE_FILE="/var/log/failover/state.json"

# Create log directory
mkdir -p /var/log/failover

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Initialize state file
init_state() {
    if [[ ! -f "$STATE_FILE" ]]; then
        cat > "$STATE_FILE" << EOF
{
    "current_primary": "$PRIMARY_HOST",
    "failover_count": 0,
    "last_failover": null,
    "primary_health_checks_failed": 0,
    "standby_1_health_checks_failed": 0,
    "standby_2_health_checks_failed": 0,
    "cluster_state": "healthy"
}
EOF
    fi
}

# Get current state
get_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        init_state
        cat "$STATE_FILE"
    fi
}

# Update state
update_state() {
    local key="$1"
    local value="$2"
    
    local temp_file=$(mktemp)
    jq ".$key = $value" "$STATE_FILE" > "$temp_file" && mv "$temp_file" "$STATE_FILE"
}

# Check if PostgreSQL is healthy
check_postgres_health() {
    local host="$1"
    local port="${2:-5432}"
    
    if pg_isready -h "$host" -p "$port" -U postgres -d prepx >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check replication lag
check_replication_lag() {
    local host="$1"
    local port="${2:-5432}"
    
    local lag_query="SELECT EXTRACT(EPOCH FROM (now() - replay_lag))::numeric as lag_seconds FROM pg_stat_replication WHERE client_addr = '$host'::inet;"
    
    local lag=$(psql -h "$host" -p "$port" -U postgres -d prepx -t -c "$lag_query" 2>/dev/null | xargs || echo "999999")
    
    if [[ "$lag" =~ ^[0-9]+\.?[0-9]*$ ]] && (( $(echo "$lag < 60" | bc -l) )); then
        return 0
    else
        return 1
    fi
}

# Promote standby to primary
promote_standby() {
    local standby_host="$1"
    local standby_port="${2:-5432}"
    
    log "Promoting $standby_host to primary"
    
    # Create trigger file to promote standby
    docker exec "$standby_host" touch /var/lib/postgresql/data/promote_trigger
    
    # Wait for promotion to complete
    local max_wait=60
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if ! check_postgres_health "$standby_host" "$standby_port"; then
            sleep 5
            wait_time=$((wait_time + 5))
            continue
        fi
        
        # Check if it's no longer in recovery mode
        local recovery_query="SELECT pg_is_in_recovery();"
        local in_recovery=$(psql -h "$standby_host" -p "$standby_port" -U postgres -d prepx -t -c "$recovery_query" 2>/dev/null | xargs || echo "true")
        
        if [[ "$in_recovery" == "f" ]]; then
            log "Successfully promoted $standby_host to primary"
            return 0
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    log "Failed to promote $standby_host within $max_wait seconds"
    return 1
}

# Update HAProxy configuration
update_haproxy_config() {
    local new_primary="$1"
    local new_standby_1="$2"
    local new_standby_2="$3"
    
    log "Updating HAProxy configuration with new primary: $new_primary"
    
    # Update HAProxy config file
    sed -i "s/server postgres-primary .*/server postgres-primary $new_primary:5432 check port 5432 inter 5s rise 2 fall 3/" /etc/haproxy/haproxy.cfg
    sed -i "s/server postgres-standby-1 .*/server postgres-standby-1 $new_standby_1:5432 check port 5432 inter 5s rise 2 fall 3 backup/" /etc/haproxy/haproxy.cfg
    sed -i "s/server postgres-standby-2 .*/server postgres-standby-2 $new_standby_2:5432 check port 5432 inter 5s rise 2 fall 3 backup/" /etc/haproxy/haproxy.cfg
    
    # Reload HAProxy configuration
    if command -v haproxy >/dev/null 2>&1; then
        haproxy -f /etc/haproxy/haproxy.cfg -p /var/run/haproxy.pid -sf $(cat /var/run/haproxy.pid)
        log "HAProxy configuration reloaded"
    else
        log "HAProxy not available for reload"
    fi
}

# Send alert
send_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    log "ALERT [$severity]: $message"
    
    # Send to monitoring system (Prometheus AlertManager)
    if command -v curl >/dev/null 2>&1; then
        curl -X POST http://alertmanager:9093/api/v1/alerts \
            -H "Content-Type: application/json" \
            -d "[{
                \"labels\": {
                    \"alertname\": \"DatabaseFailover\",
                    \"severity\": \"$severity\",
                    \"instance\": \"$PRIMARY_HOST\"
                },
                \"annotations\": {
                    \"summary\": \"Database Failover Event\",
                    \"description\": \"$message\"
                },
                \"startsAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }]" 2>/dev/null || true
    fi
}

# Perform failover
perform_failover() {
    local current_primary="$1"
    local standby_1="$2"
    local standby_2="$3"
    
    log "Initiating failover from $current_primary"
    send_alert "Database failover initiated from $current_primary" "critical"
    
    # Try to promote standby 1 first
    if promote_standby "$standby_1"; then
        update_haproxy_config "$standby_1" "$standby_2" "$current_primary"
        update_state "current_primary" "\"$standby_1\""
        update_state "failover_count" "$(($(jq -r '.failover_count' "$STATE_FILE") + 1))"
        update_state "last_failover" "\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
        update_state "cluster_state" "\"degraded\""
        
        log "Failover completed successfully. New primary: $standby_1"
        send_alert "Failover completed successfully. New primary: $standby_1" "warning"
        return 0
    fi
    
    # Try to promote standby 2 if standby 1 failed
    if promote_standby "$standby_2"; then
        update_haproxy_config "$standby_2" "$standby_1" "$current_primary"
        update_state "current_primary" "\"$standby_2\""
        update_state "failover_count" "$(($(jq -r '.failover_count' "$STATE_FILE") + 1))"
        update_state "last_failover" "\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
        update_state "cluster_state" "\"degraded\""
        
        log "Failover completed successfully. New primary: $standby_2"
        send_alert "Failover completed successfully. New primary: $standby_2" "warning"
        return 0
    fi
    
    log "CRITICAL: All failover attempts failed!"
    send_alert "CRITICAL: All failover attempts failed! Manual intervention required." "critical"
    return 1
}

# Monitor database cluster
monitor_cluster() {
    local state=$(get_state)
    local current_primary=$(echo "$state" | jq -r '.current_primary')
    local primary_health_failed=$(echo "$state" | jq -r '.primary_health_checks_failed')
    local standby_1_health_failed=$(echo "$state" | jq -r '.standby_1_health_checks_failed')
    local standby_2_health_failed=$(echo "$state" | jq -r '.standby_2_health_checks_failed')
    
    # Check primary health
    if check_postgres_health "$current_primary"; then
        update_state "primary_health_checks_failed" "0"
        log "Primary $current_primary is healthy"
    else
        local new_failed_count=$((primary_health_failed + 1))
        update_state "primary_health_checks_failed" "$new_failed_count"
        log "Primary $current_primary health check failed ($new_failed_count/$FAILOVER_THRESHOLD)"
        
        if [[ $new_failed_count -ge $FAILOVER_THRESHOLD ]]; then
            perform_failover "$current_primary" "$STANDBY_1_HOST" "$STANDBY_2_HOST"
        fi
    fi
    
    # Check standby health
    if check_postgres_health "$STANDBY_1_HOST"; then
        update_state "standby_1_health_checks_failed" "0"
        if ! check_replication_lag "$STANDBY_1_HOST"; then
            log "WARNING: Standby 1 replication lag is high"
        fi
    else
        local new_failed_count=$((standby_1_health_failed + 1))
        update_state "standby_1_health_checks_failed" "$new_failed_count"
        log "Standby 1 health check failed ($new_failed_count/$FAILOVER_THRESHOLD)"
    fi
    
    if check_postgres_health "$STANDBY_2_HOST"; then
        update_state "standby_2_health_checks_failed" "0"
        if ! check_replication_lag "$STANDBY_2_HOST"; then
            log "WARNING: Standby 2 replication lag is high"
        fi
    else
        local new_failed_count=$((standby_2_health_failed + 1))
        update_state "standby_2_health_checks_failed" "$new_failed_count"
        log "Standby 2 health check failed ($new_failed_count/$FAILOVER_THRESHOLD)"
    fi
}

# Main monitoring loop
main() {
    log "Starting failover manager"
    log "Configuration: Primary=$PRIMARY_HOST, Standby1=$STANDBY_1_HOST, Standby2=$STANDBY_2_HOST"
    log "Monitoring interval: ${MONITORING_INTERVAL}s, Failover threshold: $FAILOVER_THRESHOLD"
    
    init_state
    
    while true; do
        monitor_cluster
        sleep "$MONITORING_INTERVAL"
    done
}

# Handle signals
trap 'log "Failover manager stopped"; exit 0' SIGTERM SIGINT

# Check dependencies
if ! command -v jq >/dev/null 2>&1; then
    log "ERROR: jq is required but not installed"
    exit 1
fi

if ! command -v pg_isready >/dev/null 2>&1; then
    log "ERROR: pg_isready is required but not installed"
    exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
    log "ERROR: psql is required but not installed"
    exit 1
fi

# Start monitoring
main "$@"

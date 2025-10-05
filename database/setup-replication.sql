-- PostgreSQL Replication Setup Script for PrepX
-- This script sets up streaming replication between master and slaves

-- 1. Create replication user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replication_password_2024';
    END IF;
END
$$;

-- 2. Create monitoring user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring') THEN
        CREATE ROLE monitoring WITH LOGIN PASSWORD 'monitoring_password_2024';
        GRANT pg_monitor TO monitoring;
        GRANT SELECT ON pg_stat_database TO monitoring;
        GRANT SELECT ON pg_stat_user_tables TO monitoring;
        GRANT SELECT ON pg_stat_user_indexes TO monitoring;
        GRANT SELECT ON pg_stat_activity TO monitoring;
        GRANT SELECT ON pg_stat_replication TO monitoring;
    END IF;
END
$$;

-- 3. Grant necessary permissions
GRANT CONNECT ON DATABASE prepx_users TO replicator;
GRANT CONNECT ON DATABASE prepx_trading TO replicator;
GRANT CONNECT ON DATABASE prepx_portfolio TO replicator;
GRANT CONNECT ON DATABASE prepx_market_data TO replicator;

-- 4. Create replication slot for each database
SELECT pg_create_physical_replication_slot('replication_slot_users');
SELECT pg_create_physical_replication_slot('replication_slot_trading');
SELECT pg_create_physical_replication_slot('replication_slot_portfolio');
SELECT pg_create_physical_replication_slot('replication_slot_market_data');

-- 5. Configure pg_hba.conf entries (these need to be added manually to pg_hba.conf)
-- host replication replicator 0.0.0.0/0 md5
-- host all monitoring 0.0.0.0/0 md5

-- 6. Create views for replication monitoring
CREATE OR REPLACE VIEW replication_status AS
SELECT 
    client_addr,
    application_name,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    sync_priority
FROM pg_stat_replication;

-- 7. Create function to check replication lag
CREATE OR REPLACE FUNCTION check_replication_lag()
RETURNS TABLE (
    client_addr inet,
    application_name text,
    lag_mb numeric,
    lag_seconds numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.client_addr,
        r.application_name,
        ROUND(
            (pg_wal_lsn_diff(pg_current_wal_lsn(), r.replay_lsn) / 1024.0 / 1024.0)::numeric, 
            2
        ) as lag_mb,
        EXTRACT(EPOCH FROM (now() - r.replay_lag))::numeric as lag_seconds
    FROM pg_stat_replication r
    WHERE r.state = 'streaming';
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to promote standby to master
CREATE OR REPLACE FUNCTION promote_standby()
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Check if this is a standby server
    IF NOT pg_is_in_recovery() THEN
        RETURN 'This server is already the primary (not in recovery)';
    END IF;
    
    -- Promote to primary
    PERFORM pg_promote();
    
    RETURN 'Standby promoted to primary successfully';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error promoting standby: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to check cluster health
CREATE OR REPLACE FUNCTION cluster_health_check()
RETURNS TABLE (
    metric_name text,
    metric_value text,
    status text
) AS $$
BEGIN
    -- Check if server is in recovery
    RETURN QUERY
    SELECT 
        'recovery_mode'::text,
        CASE WHEN pg_is_in_recovery() THEN 'standby' ELSE 'primary' END::text,
        CASE WHEN pg_is_in_recovery() THEN 'ok' ELSE 'ok' END::text;
    
    -- Check replication status
    RETURN QUERY
    SELECT 
        'replication_status'::text,
        COALESCE(string_agg(application_name || ':' || state, ','), 'no_replicas')::text,
        CASE 
            WHEN COUNT(*) = 0 THEN 'warning'
            WHEN COUNT(*) FILTER (WHERE state = 'streaming') = COUNT(*) THEN 'ok'
            ELSE 'error'
        END::text
    FROM pg_stat_replication;
    
    -- Check WAL lag
    RETURN QUERY
    SELECT 
        'max_wal_lag_mb'::text,
        COALESCE(MAX(
            ROUND((pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) / 1024.0 / 1024.0)::numeric, 2)
        )::text, '0')::text,
        CASE 
            WHEN MAX(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) / 1024.0 / 1024.0) > 1024 THEN 'warning'
            ELSE 'ok'
        END::text
    FROM pg_stat_replication;
    
    -- Check connection count
    RETURN QUERY
    SELECT 
        'active_connections'::text,
        COUNT(*)::text,
        CASE 
            WHEN COUNT(*) > (SELECT setting::int * 0.8 FROM pg_settings WHERE name = 'max_connections') THEN 'warning'
            ELSE 'ok'
        END::text
    FROM pg_stat_activity;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant permissions for monitoring
GRANT EXECUTE ON FUNCTION check_replication_lag() TO monitoring;
GRANT EXECUTE ON FUNCTION cluster_health_check() TO monitoring;
GRANT SELECT ON replication_status TO monitoring;

-- 11. Create index on replication monitoring
CREATE INDEX IF NOT EXISTS idx_pg_stat_replication_client_addr 
ON pg_stat_replication(client_addr);

-- 12. Set up automatic WAL archiving (if using WAL-E or similar)
-- archive_mode = on
-- archive_command = 'wal-e wal-push %p'
-- restore_command = 'wal-e wal-fetch %f %p'

-- 13. Create tables for replication monitoring
CREATE TABLE IF NOT EXISTS replication_history (
    id SERIAL PRIMARY KEY,
    check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_addr INET,
    application_name TEXT,
    lag_mb NUMERIC,
    lag_seconds NUMERIC,
    state TEXT
);

CREATE INDEX IF NOT EXISTS idx_replication_history_time 
ON replication_history(check_time);

-- 14. Create function to log replication status
CREATE OR REPLACE FUNCTION log_replication_status()
RETURNS VOID AS $$
BEGIN
    INSERT INTO replication_history (client_addr, application_name, lag_mb, lag_seconds, state)
    SELECT 
        client_addr,
        application_name,
        ROUND((pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) / 1024.0 / 1024.0)::numeric, 2),
        EXTRACT(EPOCH FROM (now() - replay_lag))::numeric,
        state
    FROM pg_stat_replication;
    
    -- Clean up old records (keep last 7 days)
    DELETE FROM replication_history 
    WHERE check_time < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 15. Grant permissions
GRANT EXECUTE ON FUNCTION log_replication_status() TO monitoring;
GRANT INSERT, SELECT, DELETE ON replication_history TO monitoring;

-- 16. Create monitoring view for replication
CREATE OR REPLACE VIEW replication_monitoring AS
SELECT 
    r.client_addr,
    r.application_name,
    r.state,
    ROUND((pg_wal_lsn_diff(pg_current_wal_lsn(), r.replay_lsn) / 1024.0 / 1024.0)::numeric, 2) as lag_mb,
    EXTRACT(EPOCH FROM (now() - r.replay_lag))::numeric as lag_seconds,
    r.sync_state,
    r.sync_priority,
    CASE 
        WHEN EXTRACT(EPOCH FROM (now() - r.replay_lag)) > 60 THEN 'LAG_HIGH'
        WHEN EXTRACT(EPOCH FROM (now() - r.replay_lag)) > 30 THEN 'LAG_MEDIUM'
        ELSE 'LAG_OK'
    END as lag_status
FROM pg_stat_replication r;

GRANT SELECT ON replication_monitoring TO monitoring;

COMMENT ON VIEW replication_monitoring IS 'Real-time replication monitoring view';
COMMENT ON FUNCTION check_replication_lag() IS 'Returns replication lag information';
COMMENT ON FUNCTION cluster_health_check() IS 'Comprehensive cluster health check';
COMMENT ON FUNCTION promote_standby() IS 'Promotes standby server to primary';
COMMENT ON FUNCTION log_replication_status() IS 'Logs current replication status to history table';

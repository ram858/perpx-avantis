-- Database Index Optimization for PrepX
-- Optimized for millions of users and high-frequency trading

-- ============================================================================
-- USERS DATABASE OPTIMIZATION
-- ============================================================================

\c prepx_users;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_token;
DROP INDEX IF EXISTS idx_user_sessions_expires;

-- Create optimized indexes for users table
CREATE INDEX CONCURRENTLY idx_users_email_hash ON users USING hash (email);
CREATE INDEX CONCURRENTLY idx_users_status_active ON users (id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_users_created_at_btree ON users USING btree (created_at);
CREATE INDEX CONCURRENTLY idx_users_last_login ON users (last_login) WHERE last_login IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_users_email_verified ON users (email_verified, created_at);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_status_created ON users (status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_users_active_login ON users (status, last_login DESC) WHERE status = 'active';

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY idx_users_unverified ON users (created_at) WHERE email_verified = false;
CREATE INDEX CONCURRENTLY idx_users_suspended ON users (created_at) WHERE status = 'suspended';

-- User sessions optimization
CREATE INDEX CONCURRENTLY idx_user_sessions_user_id_btree ON user_sessions USING btree (user_id);
CREATE INDEX CONCURRENTLY idx_user_sessions_token_hash ON user_sessions USING hash (session_token);
CREATE INDEX CONCURRENTLY idx_user_sessions_expires_active ON user_sessions (expires_at) WHERE expires_at > NOW();
CREATE INDEX CONCURRENTLY idx_user_sessions_user_expires ON user_sessions (user_id, expires_at DESC);
CREATE INDEX CONCURRENTLY idx_user_sessions_ip_user ON user_sessions (ip_address, user_id);

-- ============================================================================
-- TRADING DATABASE OPTIMIZATION
-- ============================================================================

\c prepx_trading;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_trading_sessions_user_id;
DROP INDEX IF EXISTS idx_trading_sessions_status;
DROP INDEX IF EXISTS idx_trading_sessions_created_at;
DROP INDEX IF EXISTS idx_trading_positions_session_id;
DROP INDEX IF EXISTS idx_trading_positions_symbol;
DROP INDEX IF EXISTS idx_trading_orders_session_id;
DROP INDEX IF EXISTS idx_trading_orders_status;

-- Trading sessions optimization
CREATE INDEX CONCURRENTLY idx_trading_sessions_user_id_hash ON trading_sessions USING hash (user_id);
CREATE INDEX CONCURRENTLY idx_trading_sessions_status_btree ON trading_sessions USING btree (status);
CREATE INDEX CONCURRENTLY idx_trading_sessions_created_at_btree ON trading_sessions USING btree (created_at DESC);
CREATE INDEX CONCURRENTLY idx_trading_sessions_user_status ON trading_sessions (user_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_trading_sessions_active ON trading_sessions (user_id, created_at DESC) WHERE status IN ('running', 'starting');

-- Partial indexes for active sessions
CREATE INDEX CONCURRENTLY idx_trading_sessions_running ON trading_sessions (user_id, created_at DESC) WHERE status = 'running';
CREATE INDEX CONCURRENTLY idx_trading_sessions_completed ON trading_sessions (user_id, created_at DESC) WHERE status = 'completed';

-- Trading positions optimization
CREATE INDEX CONCURRENTLY idx_trading_positions_session_id_btree ON trading_positions USING btree (session_id);
CREATE INDEX CONCURRENTLY idx_trading_positions_symbol_btree ON trading_positions USING btree (symbol);
CREATE INDEX CONCURRENTLY idx_trading_positions_status ON trading_positions (status, opened_at DESC);
CREATE INDEX CONCURRENTLY idx_trading_positions_open ON trading_positions (session_id, status) WHERE status = 'open';
CREATE INDEX CONCURRENTLY idx_trading_positions_symbol_status ON trading_positions (symbol, status, opened_at DESC);

-- Composite indexes for position queries
CREATE INDEX CONCURRENTLY idx_trading_positions_session_symbol ON trading_positions (session_id, symbol, status);
CREATE INDEX CONCURRENTLY idx_trading_positions_symbol_opened ON trading_positions (symbol, opened_at DESC) WHERE status = 'open';

-- Trading orders optimization
CREATE INDEX CONCURRENTLY idx_trading_orders_session_id_btree ON trading_orders USING btree (session_id);
CREATE INDEX CONCURRENTLY idx_trading_orders_status_btree ON trading_orders USING btree (status);
CREATE INDEX CONCURRENTLY idx_trading_orders_created_at ON trading_orders (created_at DESC);
CREATE INDEX CONCURRENTLY idx_trading_orders_symbol_status ON trading_orders (symbol, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_trading_orders_pending ON trading_orders (session_id, created_at DESC) WHERE status = 'pending';

-- Partial indexes for order status
CREATE INDEX CONCURRENTLY idx_trading_orders_filled ON trading_orders (session_id, filled_at DESC) WHERE status = 'filled';
CREATE INDEX CONCURRENTLY idx_trading_orders_rejected ON trading_orders (session_id, created_at DESC) WHERE status = 'rejected';

-- ============================================================================
-- PORTFOLIO DATABASE OPTIMIZATION
-- ============================================================================

\c prepx_portfolio;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_portfolio_snapshots_user_id;
DROP INDEX IF EXISTS idx_portfolio_snapshots_created_at;
DROP INDEX IF EXISTS idx_portfolio_positions_user_id;
DROP INDEX IF EXISTS idx_portfolio_positions_symbol;

-- Portfolio snapshots optimization
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_user_id_hash ON portfolio_snapshots USING hash (user_id);
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_created_at_btree ON portfolio_snapshots USING btree (created_at DESC);
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_user_created ON portfolio_snapshots (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_session_id ON portfolio_snapshots (session_id, created_at DESC) WHERE session_id IS NOT NULL;

-- Latest portfolio snapshots
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_latest ON portfolio_snapshots (user_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '1 day';

-- Portfolio positions optimization
CREATE INDEX CONCURRENTLY idx_portfolio_positions_user_id_hash ON portfolio_positions USING hash (user_id);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_symbol_btree ON portfolio_positions USING btree (symbol);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_user_symbol ON portfolio_positions (user_id, symbol);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_updated_at ON portfolio_positions (updated_at DESC);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_active ON portfolio_positions (user_id, symbol, updated_at DESC) WHERE quantity != 0;

-- ============================================================================
-- MARKET DATA DATABASE OPTIMIZATION
-- ============================================================================

\c prepx_market_data;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_market_data_symbol;
DROP INDEX IF EXISTS idx_market_data_timestamp;
DROP INDEX IF EXISTS idx_ohlcv_data_symbol_timeframe;
DROP INDEX IF EXISTS idx_ohlcv_data_timestamp;

-- Market data optimization
CREATE INDEX CONCURRENTLY idx_market_data_symbol_btree ON market_data USING btree (symbol);
CREATE INDEX CONCURRENTLY idx_market_data_timestamp_btree ON market_data USING btree (timestamp DESC);
CREATE INDEX CONCURRENTLY idx_market_data_symbol_timestamp ON market_data (symbol, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_market_data_recent ON market_data (symbol, timestamp DESC) WHERE timestamp > NOW() - INTERVAL '1 hour';

-- OHLCV data optimization
CREATE INDEX CONCURRENTLY idx_ohlcv_data_symbol_timeframe_btree ON ohlcv_data USING btree (symbol, timeframe);
CREATE INDEX CONCURRENTLY idx_ohlcv_data_timestamp_btree ON ohlcv_data USING btree (timestamp DESC);
CREATE INDEX CONCURRENTLY idx_ohlcv_data_symbol_timeframe_timestamp ON ohlcv_data (symbol, timeframe, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_ohlcv_data_recent ON ohlcv_data (symbol, timeframe, timestamp DESC) WHERE timestamp > NOW() - INTERVAL '1 day';

-- Partial indexes for different timeframes
CREATE INDEX CONCURRENTLY idx_ohlcv_data_1m ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '1m';
CREATE INDEX CONCURRENTLY idx_ohlcv_data_5m ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '5m';
CREATE INDEX CONCURRENTLY idx_ohlcv_data_15m ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '15m';
CREATE INDEX CONCURRENTLY idx_ohlcv_data_1h ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '1h';
CREATE INDEX CONCURRENTLY idx_ohlcv_data_4h ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '4h';
CREATE INDEX CONCURRENTLY idx_ohlcv_data_1d ON ohlcv_data (symbol, timestamp DESC) WHERE timeframe = '1d';

-- ============================================================================
-- PERFORMANCE VIEWS AND FUNCTIONS
-- ============================================================================

-- Create performance monitoring views
CREATE OR REPLACE VIEW database_performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY schemaname, tablename, attname;

-- Index usage statistics view
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan > 0 THEN (idx_tup_fetch::float / idx_scan)::numeric(10,2)
        ELSE 0 
    END as avg_tuples_per_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table size and performance view
CREATE OR REPLACE VIEW table_performance_stats AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- ============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to analyze and optimize slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE (
    query_text text,
    calls bigint,
    total_time numeric,
    mean_time numeric,
    rows bigint,
    shared_blks_hit bigint,
    shared_blks_read bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows,
        shared_blks_hit,
        shared_blks_read
    FROM pg_stat_statements
    WHERE mean_exec_time > 1000  -- Queries taking more than 1 second
    ORDER BY mean_exec_time DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to get index recommendations
CREATE OR REPLACE FUNCTION get_index_recommendations()
RETURNS TABLE (
    table_name text,
    column_name text,
    recommendation text,
    estimated_benefit text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::text,
        a.attname::text,
        CASE 
            WHEN s.n_distinct > 1000 THEN 'CREATE INDEX ON ' || t.relname || ' (' || a.attname || ');'
            WHEN s.correlation < 0.1 THEN 'CREATE INDEX ON ' || t.relname || ' (' || a.attname || ');'
            ELSE 'No recommendation'
        END as recommendation,
        CASE 
            WHEN s.n_distinct > 1000 THEN 'High cardinality - good for filtering'
            WHEN s.correlation < 0.1 THEN 'Low correlation - good for sorting'
            ELSE 'Low benefit'
        END as estimated_benefit
    FROM pg_class t
    JOIN pg_attribute a ON t.oid = a.attrelid
    JOIN pg_stats s ON t.relname = s.tablename AND a.attname = s.attname
    WHERE t.relkind = 'r'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND s.schemaname = 'public'
    AND (s.n_distinct > 1000 OR s.correlation < 0.1)
    ORDER BY s.n_distinct DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to monitor query performance
CREATE OR REPLACE FUNCTION monitor_query_performance()
RETURNS TABLE (
    database_name text,
    query_count bigint,
    avg_execution_time numeric,
    total_execution_time numeric,
    slow_queries bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        datname::text,
        numbackends,
        (SELECT AVG(mean_exec_time) FROM pg_stat_statements),
        (SELECT SUM(total_exec_time) FROM pg_stat_statements),
        (SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000)
    FROM pg_stat_database
    WHERE datname NOT IN ('template0', 'template1', 'postgres')
    ORDER BY numbackends DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
DECLARE
    table_record record;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
    LOOP
        EXECUTE format('ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days integer DEFAULT 90)
RETURNS void AS $$
BEGIN
    -- Clean up old trading sessions
    DELETE FROM prepx_trading.trading_sessions 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days 
    AND status IN ('completed', 'error', 'stopped');
    
    -- Clean up old portfolio snapshots
    DELETE FROM prepx_portfolio.portfolio_snapshots 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    -- Clean up old market data (keep more recent data)
    DELETE FROM prepx_market_data.market_data 
    WHERE timestamp < NOW() - INTERVAL '1 day' * (retention_days / 2);
    
    -- Clean up old OHLCV data (keep more recent data)
    DELETE FROM prepx_market_data.ohlcv_data 
    WHERE timestamp < NOW() - INTERVAL '1 day' * (retention_days / 2);
    
    -- Vacuum all databases
    PERFORM update_table_statistics();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to monitoring user
GRANT SELECT ON database_performance_stats TO monitoring;
GRANT SELECT ON index_usage_stats TO monitoring;
GRANT SELECT ON table_performance_stats TO monitoring;
GRANT EXECUTE ON FUNCTION analyze_slow_queries() TO monitoring;
GRANT EXECUTE ON FUNCTION get_index_recommendations() TO monitoring;
GRANT EXECUTE ON FUNCTION monitor_query_performance() TO monitoring;
GRANT EXECUTE ON FUNCTION update_table_statistics() TO monitoring;
GRANT EXECUTE ON FUNCTION cleanup_old_data(integer) TO monitoring;

-- Grant permissions to application users
GRANT SELECT ON database_performance_stats TO prepx_app;
GRANT SELECT ON index_usage_stats TO prepx_app;
GRANT SELECT ON table_performance_stats TO prepx_app;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON VIEW database_performance_stats IS 'Statistics about database table columns and their distribution';
COMMENT ON VIEW index_usage_stats IS 'Statistics about index usage and performance';
COMMENT ON VIEW table_performance_stats IS 'Statistics about table performance and maintenance';

COMMENT ON FUNCTION analyze_slow_queries() IS 'Identifies and analyzes slow-running queries';
COMMENT ON FUNCTION get_index_recommendations() IS 'Provides recommendations for creating new indexes';
COMMENT ON FUNCTION monitor_query_performance() IS 'Monitors overall query performance across databases';
COMMENT ON FUNCTION update_table_statistics() IS 'Updates statistics for all tables to improve query planning';
COMMENT ON FUNCTION cleanup_old_data(integer) IS 'Cleans up old data based on retention period';

-- ============================================================================
-- AUTOMATED MAINTENANCE SCHEDULE
-- ============================================================================

-- Create a function to run maintenance tasks
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Update statistics
    PERFORM update_table_statistics();
    
    -- Clean up old data (90 days retention)
    PERFORM cleanup_old_data(90);
    
    -- Log maintenance completion
    INSERT INTO prepx_users.maintenance_log (task_name, completed_at, status)
    VALUES ('daily_maintenance', NOW(), 'completed');
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO prepx_users.maintenance_log (task_name, completed_at, status, error_message)
        VALUES ('daily_maintenance', NOW(), 'failed', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS prepx_users.maintenance_log (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed')),
    error_message TEXT,
    execution_time INTERVAL
);

-- Create index on maintenance log
CREATE INDEX IF NOT EXISTS idx_maintenance_log_completed_at ON prepx_users.maintenance_log (completed_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON prepx_users.maintenance_log TO monitoring;
GRANT EXECUTE ON FUNCTION run_maintenance_tasks() TO monitoring;

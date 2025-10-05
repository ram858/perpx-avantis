-- Horizontal Database Sharding Setup for PrepX
-- Implements user-based sharding for millions of users

-- ============================================================================
-- SHARDING CONFIGURATION
-- ============================================================================

-- Create sharding configuration table
CREATE TABLE IF NOT EXISTS shard_config (
    shard_id INTEGER PRIMARY KEY,
    shard_name VARCHAR(50) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert shard configurations
INSERT INTO shard_config (shard_id, shard_name, host, port, database_name) VALUES
(0, 'shard_0', 'postgres-shard-0', 5432, 'prepx_shard_0'),
(1, 'shard_1', 'postgres-shard-1', 5432, 'prepx_shard_1'),
(2, 'shard_2', 'postgres-shard-2', 5432, 'prepx_shard_2'),
(3, 'shard_3', 'postgres-shard-3', 5432, 'prepx_shard_3'),
(4, 'shard_4', 'postgres-shard-4', 5432, 'prepx_shard_4'),
(5, 'shard_5', 'postgres-shard-5', 5432, 'prepx_shard_5'),
(6, 'shard_6', 'postgres-shard-6', 5432, 'prepx_shard_6'),
(7, 'shard_7', 'postgres-shard-7', 5432, 'prepx_shard_7'),
(8, 'shard_8', 'postgres-shard-8', 5432, 'prepx_shard_8'),
(9, 'shard_9', 'postgres-shard-9', 5432, 'prepx_shard_9'),
(10, 'shard_10', 'postgres-shard-10', 5432, 'prepx_shard_10'),
(11, 'shard_11', 'postgres-shard-11', 5432, 'prepx_shard_11'),
(12, 'shard_12', 'postgres-shard-12', 5432, 'prepx_shard_12'),
(13, 'shard_13', 'postgres-shard-13', 5432, 'prepx_shard_13'),
(14, 'shard_14', 'postgres-shard-14', 5432, 'prepx_shard_14'),
(15, 'shard_15', 'postgres-shard-15', 5432, 'prepx_shard_15');

-- ============================================================================
-- SHARDING FUNCTIONS
-- ============================================================================

-- Function to determine shard for a user ID
CREATE OR REPLACE FUNCTION get_shard_for_user(user_id BIGINT)
RETURNS INTEGER AS $$
BEGIN
    -- Use modulo operation to distribute users across shards
    RETURN user_id % 16;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get shard connection info
CREATE OR REPLACE FUNCTION get_shard_info(shard_id INTEGER)
RETURNS TABLE (
    shard_name VARCHAR(50),
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT sc.shard_name, sc.host, sc.port, sc.database_name
    FROM shard_config sc
    WHERE sc.shard_id = get_shard_for_user(shard_id)
    AND sc.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get all active shards
CREATE OR REPLACE FUNCTION get_active_shards()
RETURNS TABLE (
    shard_id INTEGER,
    shard_name VARCHAR(50),
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT sc.shard_id, sc.shard_name, sc.host, sc.port, sc.database_name
    FROM shard_config sc
    WHERE sc.is_active = true
    ORDER BY sc.shard_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SHARDED TABLES SETUP
-- ============================================================================

-- Create sharded users table
CREATE TABLE IF NOT EXISTS users_sharded (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    shard_id INTEGER GENERATED ALWAYS AS (get_shard_for_user(id)) STORED
) PARTITION BY HASH (id);

-- Create partitions for each shard
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS users_shard_%s PARTITION OF users_sharded FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

-- Create sharded trading sessions table
CREATE TABLE IF NOT EXISTS trading_sessions_sharded (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    max_budget DECIMAL(20,8) NOT NULL,
    profit_goal DECIMAL(20,8) NOT NULL,
    max_positions INTEGER NOT NULL,
    strategy VARCHAR(50) DEFAULT 'default',
    status VARCHAR(20) DEFAULT 'starting' CHECK (status IN ('starting', 'running', 'stopped', 'completed', 'error')),
    current_pnl DECIMAL(20,8) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shard_id INTEGER GENERATED ALWAYS AS (get_shard_for_user(user_id)) STORED
) PARTITION BY HASH (user_id);

-- Create partitions for trading sessions
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS trading_sessions_shard_%s PARTITION OF trading_sessions_sharded FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

-- Create sharded trading positions table
CREATE TABLE IF NOT EXISTS trading_positions_sharded (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price DECIMAL(20,8) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    leverage INTEGER DEFAULT 1,
    stop_loss DECIMAL(20,8),
    take_profit DECIMAL(20,8),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated')),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    user_id BIGINT NOT NULL,
    shard_id INTEGER GENERATED ALWAYS AS (get_shard_for_user(user_id)) STORED
) PARTITION BY HASH (user_id);

-- Create partitions for trading positions
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS trading_positions_shard_%s PARTITION OF trading_positions_sharded FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

-- Create sharded portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots_sharded (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id VARCHAR(100),
    total_value DECIMAL(20,8) NOT NULL,
    cash_balance DECIMAL(20,8) NOT NULL,
    invested_amount DECIMAL(20,8) NOT NULL,
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    total_pnl DECIMAL(20,8) DEFAULT 0,
    open_positions INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2),
    profit_factor DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shard_id INTEGER GENERATED ALWAYS AS (get_shard_for_user(user_id)) STORED
) PARTITION BY HASH (user_id);

-- Create partitions for portfolio snapshots
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..15 LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS portfolio_snapshots_shard_%s PARTITION OF portfolio_snapshots_sharded FOR VALUES WITH (modulus 16, remainder %s)', i, i);
    END LOOP;
END $$;

-- ============================================================================
-- SHARDING ROUTING FUNCTIONS
-- ============================================================================

-- Function to route queries to appropriate shard
CREATE OR REPLACE FUNCTION route_to_shard(user_id BIGINT, query_type VARCHAR(20))
RETURNS TABLE (
    shard_id INTEGER,
    connection_string TEXT
) AS $$
DECLARE
    target_shard INTEGER;
    shard_info RECORD;
BEGIN
    target_shard := get_shard_for_user(user_id);
    
    SELECT * INTO shard_info
    FROM shard_config
    WHERE shard_id = target_shard AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active shard found for user_id: %', user_id;
    END IF;
    
    RETURN QUERY
    SELECT 
        target_shard,
        format('host=%s port=%s dbname=%s user=postgres password=%s', 
               shard_info.host, 
               shard_info.port, 
               shard_info.database_name,
               'your_password_here')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to get user data from correct shard
CREATE OR REPLACE FUNCTION get_user_from_shard(user_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    target_shard INTEGER;
BEGIN
    target_shard := get_shard_for_user(user_id);
    
    RETURN QUERY
    EXECUTE format('SELECT id, email, first_name, last_name, status, created_at FROM users_shard_%s WHERE id = $1', target_shard)
    USING user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get trading sessions from correct shard
CREATE OR REPLACE FUNCTION get_trading_sessions_from_shard(user_id BIGINT, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id BIGINT,
    session_id VARCHAR(100),
    user_id BIGINT,
    status VARCHAR(20),
    current_pnl DECIMAL(20,8),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    target_shard INTEGER;
BEGIN
    target_shard := get_shard_for_user(user_id);
    
    RETURN QUERY
    EXECUTE format('SELECT id, session_id, user_id, status, current_pnl, created_at FROM trading_sessions_shard_%s WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', target_shard)
    USING user_id, limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CROSS-SHARD QUERY FUNCTIONS
-- ============================================================================

-- Function to get aggregate statistics across all shards
CREATE OR REPLACE FUNCTION get_global_user_stats()
RETURNS TABLE (
    total_users BIGINT,
    active_users BIGINT,
    suspended_users BIGINT,
    new_users_today BIGINT
) AS $$
DECLARE
    total_count BIGINT := 0;
    active_count BIGINT := 0;
    suspended_count BIGINT := 0;
    new_today_count BIGINT := 0;
    shard_record RECORD;
BEGIN
    FOR shard_record IN SELECT shard_id, shard_name FROM shard_config WHERE is_active = true
    LOOP
        -- This would need to be implemented with actual connections to shards
        -- For now, we'll use the partitioned tables
        SELECT 
            COUNT(*) + total_count,
            COUNT(*) FILTER (WHERE status = 'active') + active_count,
            COUNT(*) FILTER (WHERE status = 'suspended') + suspended_count,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) + new_today_count
        INTO total_count, active_count, suspended_count, new_today_count
        FROM users_sharded;
    END LOOP;
    
    RETURN QUERY SELECT total_count, active_count, suspended_count, new_today_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user count by shard
CREATE OR REPLACE FUNCTION get_user_count_by_shard()
RETURNS TABLE (
    shard_id INTEGER,
    shard_name VARCHAR(50),
    user_count BIGINT,
    active_users BIGINT
) AS $$
DECLARE
    shard_record RECORD;
    user_count BIGINT;
    active_count BIGINT;
BEGIN
    FOR shard_record IN 
        SELECT sc.shard_id, sc.shard_name 
        FROM shard_config sc 
        WHERE sc.is_active = true
        ORDER BY sc.shard_id
    LOOP
        -- Count users in each shard partition
        EXECUTE format('SELECT COUNT(*), COUNT(*) FILTER (WHERE status = ''active'') FROM users_shard_%s', shard_record.shard_id)
        INTO user_count, active_count;
        
        RETURN QUERY SELECT shard_record.shard_id, shard_record.shard_name, user_count, active_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SHARD MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to add a new shard
CREATE OR REPLACE FUNCTION add_shard(
    shard_name VARCHAR(50),
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(100)
)
RETURNS INTEGER AS $$
DECLARE
    new_shard_id INTEGER;
BEGIN
    -- Get next available shard ID
    SELECT COALESCE(MAX(shard_id), -1) + 1 INTO new_shard_id FROM shard_config;
    
    -- Insert new shard configuration
    INSERT INTO shard_config (shard_id, shard_name, host, port, database_name)
    VALUES (new_shard_id, shard_name, host, port, database_name);
    
    RETURN new_shard_id;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate a shard
CREATE OR REPLACE FUNCTION deactivate_shard(shard_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE shard_config 
    SET is_active = false, updated_at = NOW()
    WHERE shard_id = deactivate_shard.shard_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to reactivate a shard
CREATE OR REPLACE FUNCTION reactivate_shard(shard_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE shard_config 
    SET is_active = true, updated_at = NOW()
    WHERE shard_id = reactivate_shard.shard_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SHARD MONITORING FUNCTIONS
-- ============================================================================

-- Function to monitor shard health
CREATE OR REPLACE FUNCTION monitor_shard_health()
RETURNS TABLE (
    shard_id INTEGER,
    shard_name VARCHAR(50),
    is_active BOOLEAN,
    user_count BIGINT,
    last_updated TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(20)
) AS $$
DECLARE
    shard_record RECORD;
    user_count BIGINT;
    health_status VARCHAR(20);
BEGIN
    FOR shard_record IN 
        SELECT sc.shard_id, sc.shard_name, sc.is_active, sc.updated_at
        FROM shard_config sc
        ORDER BY sc.shard_id
    LOOP
        IF shard_record.is_active THEN
            -- Count users in shard
            EXECUTE format('SELECT COUNT(*) FROM users_shard_%s', shard_record.shard_id)
            INTO user_count;
            
            -- Determine health status
            health_status := CASE 
                WHEN user_count > 0 THEN 'healthy'
                ELSE 'empty'
            END;
        ELSE
            user_count := 0;
            health_status := 'inactive';
        END IF;
        
        RETURN QUERY SELECT 
            shard_record.shard_id,
            shard_record.shard_name,
            shard_record.is_active,
            user_count,
            shard_record.updated_at,
            health_status;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get shard load distribution
CREATE OR REPLACE FUNCTION get_shard_load_distribution()
RETURNS TABLE (
    shard_id INTEGER,
    shard_name VARCHAR(50),
    user_count BIGINT,
    trading_sessions BIGINT,
    active_sessions BIGINT,
    load_percentage NUMERIC(5,2)
) AS $$
DECLARE
    shard_record RECORD;
    user_count BIGINT;
    session_count BIGINT;
    active_session_count BIGINT;
    total_users BIGINT;
    load_pct NUMERIC(5,2);
BEGIN
    -- Get total users across all shards
    SELECT COUNT(*) INTO total_users FROM users_sharded;
    
    FOR shard_record IN 
        SELECT sc.shard_id, sc.shard_name
        FROM shard_config sc
        WHERE sc.is_active = true
        ORDER BY sc.shard_id
    LOOP
        -- Count users in shard
        EXECUTE format('SELECT COUNT(*) FROM users_shard_%s', shard_record.shard_id)
        INTO user_count;
        
        -- Count trading sessions in shard
        EXECUTE format('SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN (''running'', ''starting'')) FROM trading_sessions_shard_%s', shard_record.shard_id)
        INTO session_count, active_session_count;
        
        -- Calculate load percentage
        IF total_users > 0 THEN
            load_pct := (user_count::NUMERIC / total_users::NUMERIC) * 100;
        ELSE
            load_pct := 0;
        END IF;
        
        RETURN QUERY SELECT 
            shard_record.shard_id,
            shard_record.shard_name,
            user_count,
            session_count,
            active_session_count,
            load_pct;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SHARD MIGRATION FUNCTIONS
-- ============================================================================

-- Function to migrate users between shards (for rebalancing)
CREATE OR REPLACE FUNCTION migrate_users_between_shards(
    source_shard_id INTEGER,
    target_shard_id INTEGER,
    batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE (
    migrated_count INTEGER,
    remaining_count INTEGER
) AS $$
DECLARE
    migrated_count INTEGER := 0;
    remaining_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- This is a simplified version - in practice, you'd need to:
    -- 1. Copy data to target shard
    -- 2. Update shard_id in source shard
    -- 3. Handle foreign key constraints
    -- 4. Ensure atomicity
    
    -- For now, just return counts
    EXECUTE format('SELECT COUNT(*) FROM users_shard_%s', source_shard_id)
    INTO remaining_count;
    
    RETURN QUERY SELECT migrated_count, remaining_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR SHARDED TABLES
-- ============================================================================

-- Create indexes on sharded tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sharded_email ON users_sharded (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sharded_status ON users_sharded (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sharded_created_at ON users_sharded (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sharded_shard_id ON users_sharded (shard_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_sharded_user_id ON trading_sessions_sharded (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_sharded_status ON trading_sessions_sharded (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_sharded_created_at ON trading_sessions_sharded (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_sharded_shard_id ON trading_sessions_sharded (shard_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_sharded_user_id ON trading_positions_sharded (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_sharded_session_id ON trading_positions_sharded (session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_sharded_symbol ON trading_positions_sharded (symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_sharded_shard_id ON trading_positions_sharded (shard_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_snapshots_sharded_user_id ON portfolio_snapshots_sharded (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_snapshots_sharded_created_at ON portfolio_snapshots_sharded (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_snapshots_sharded_shard_id ON portfolio_snapshots_sharded (shard_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to application users
GRANT SELECT, INSERT, UPDATE, DELETE ON users_sharded TO prepx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON trading_sessions_sharded TO prepx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON trading_positions_sharded TO prepx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_snapshots_sharded TO prepx_app;

-- Grant permissions to monitoring user
GRANT SELECT ON shard_config TO monitoring;
GRANT SELECT ON users_sharded TO monitoring;
GRANT SELECT ON trading_sessions_sharded TO monitoring;
GRANT SELECT ON trading_positions_sharded TO monitoring;
GRANT SELECT ON portfolio_snapshots_sharded TO monitoring;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_shard_for_user(BIGINT) TO prepx_app;
GRANT EXECUTE ON FUNCTION get_shard_info(INTEGER) TO prepx_app;
GRANT EXECUTE ON FUNCTION get_active_shards() TO prepx_app;
GRANT EXECUTE ON FUNCTION route_to_shard(BIGINT, VARCHAR) TO prepx_app;
GRANT EXECUTE ON FUNCTION get_user_from_shard(BIGINT) TO prepx_app;
GRANT EXECUTE ON FUNCTION get_trading_sessions_from_shard(BIGINT, INTEGER) TO prepx_app;
GRANT EXECUTE ON FUNCTION get_global_user_stats() TO monitoring;
GRANT EXECUTE ON FUNCTION get_user_count_by_shard() TO monitoring;
GRANT EXECUTE ON FUNCTION add_shard(VARCHAR, VARCHAR, INTEGER, VARCHAR) TO monitoring;
GRANT EXECUTE ON FUNCTION deactivate_shard(INTEGER) TO monitoring;
GRANT EXECUTE ON FUNCTION reactivate_shard(INTEGER) TO monitoring;
GRANT EXECUTE ON FUNCTION monitor_shard_health() TO monitoring;
GRANT EXECUTE ON FUNCTION get_shard_load_distribution() TO monitoring;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE shard_config IS 'Configuration for database shards';
COMMENT ON FUNCTION get_shard_for_user(BIGINT) IS 'Determines which shard a user belongs to based on user ID';
COMMENT ON FUNCTION get_shard_info(INTEGER) IS 'Returns connection information for a specific shard';
COMMENT ON FUNCTION route_to_shard(BIGINT, VARCHAR) IS 'Routes queries to the appropriate shard for a user';
COMMENT ON FUNCTION get_user_from_shard(BIGINT) IS 'Retrieves user data from the correct shard';
COMMENT ON FUNCTION get_global_user_stats() IS 'Returns aggregate statistics across all shards';
COMMENT ON FUNCTION monitor_shard_health() IS 'Monitors the health status of all shards';
COMMENT ON FUNCTION get_shard_load_distribution() IS 'Shows load distribution across shards';

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Create a view for easy shard monitoring
CREATE OR REPLACE VIEW shard_monitoring AS
SELECT 
    sc.shard_id,
    sc.shard_name,
    sc.host,
    sc.port,
    sc.database_name,
    sc.is_active,
    COALESCE(us.user_count, 0) as user_count,
    COALESCE(ts.session_count, 0) as session_count,
    COALESCE(ts.active_sessions, 0) as active_sessions,
    sc.created_at,
    sc.updated_at
FROM shard_config sc
LEFT JOIN (
    SELECT 
        shard_id,
        COUNT(*) as user_count
    FROM users_sharded
    GROUP BY shard_id
) us ON sc.shard_id = us.shard_id
LEFT JOIN (
    SELECT 
        shard_id,
        COUNT(*) as session_count,
        COUNT(*) FILTER (WHERE status IN ('running', 'starting')) as active_sessions
    FROM trading_sessions_sharded
    GROUP BY shard_id
) ts ON sc.shard_id = ts.shard_id
ORDER BY sc.shard_id;

GRANT SELECT ON shard_monitoring TO monitoring;

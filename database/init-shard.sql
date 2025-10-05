-- Initialize individual shard database
-- This script runs on each shard instance

-- Create the sharded tables for this specific shard
-- Users table
CREATE TABLE IF NOT EXISTS users (
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
    last_login TIMESTAMP WITH TIME ZONE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading sessions table
CREATE TABLE IF NOT EXISTS trading_sessions (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading positions table
CREATE TABLE IF NOT EXISTS trading_positions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES trading_sessions(session_id) ON DELETE CASCADE,
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
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Trading orders table
CREATE TABLE IF NOT EXISTS trading_orders (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES trading_sessions(session_id) ON DELETE CASCADE,
    position_id BIGINT REFERENCES trading_positions(id) ON DELETE SET NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
    filled_quantity DECIMAL(20,8) DEFAULT 0,
    filled_price DECIMAL(20,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio positions table
CREATE TABLE IF NOT EXISTS portfolio_positions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    quantity DECIMAL(20,8) NOT NULL,
    average_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    market_value DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    leverage INTEGER DEFAULT 1,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_user_id ON trading_sessions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_status ON trading_sessions (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_sessions_created_at ON trading_sessions (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_session_id ON trading_positions (session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_symbol ON trading_positions (symbol);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_positions_status ON trading_positions (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_orders_session_id ON trading_orders (session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_orders_status ON trading_orders (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trading_orders_created_at ON trading_orders (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_snapshots_user_id ON portfolio_snapshots (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_snapshots_created_at ON portfolio_snapshots (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_positions_user_id ON portfolio_positions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_positions_symbol ON portfolio_positions (symbol);

-- Create application users
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'prepx_app') THEN
        CREATE ROLE prepx_app WITH LOGIN PASSWORD 'prepx_app_password';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring') THEN
        CREATE ROLE monitoring WITH LOGIN PASSWORD 'monitoring_password';
        GRANT pg_monitor TO monitoring;
    END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prepx_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prepx_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;

-- Create views for monitoring
CREATE OR REPLACE VIEW shard_stats AS
SELECT 
    'users' as table_name,
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today
FROM users
UNION ALL
SELECT 
    'trading_sessions' as table_name,
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE status IN ('running', 'starting')) as active_count,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today
FROM trading_sessions
UNION ALL
SELECT 
    'trading_positions' as table_name,
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE status = 'open') as active_count,
    COUNT(*) FILTER (WHERE opened_at >= CURRENT_DATE) as new_today
FROM trading_positions;

GRANT SELECT ON shard_stats TO monitoring;

-- Create function to get shard health
CREATE OR REPLACE FUNCTION get_shard_health()
RETURNS TABLE (
    database_name text,
    table_count integer,
    total_records bigint,
    last_updated timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::text,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::integer,
        (SELECT SUM(n_live_tup) FROM pg_stat_user_tables)::bigint,
        NOW();
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_shard_health() TO monitoring;

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS maintenance_log (
    id SERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed')),
    error_message TEXT,
    execution_time INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_completed_at ON maintenance_log (completed_at DESC);

GRANT SELECT, INSERT ON maintenance_log TO monitoring;

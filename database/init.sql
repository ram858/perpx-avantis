-- Database initialization script for scalable PrepX architecture

-- Create databases
CREATE DATABASE prepx_users;
CREATE DATABASE prepx_trading;
CREATE DATABASE prepx_portfolio;
CREATE DATABASE prepx_market_data;

-- Connect to users database
\c prepx_users;

-- Users table with partitioning
CREATE TABLE users (
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
) PARTITION BY HASH (id);

-- Create user partitions
CREATE TABLE users_p0 PARTITION OF users FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE users_p1 PARTITION OF users FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE users_p2 PARTITION OF users FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE users_p3 PARTITION OF users FOR VALUES WITH (modulus 4, remainder 3);

-- User sessions table
CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY HASH (user_id);

-- Create session partitions
CREATE TABLE user_sessions_p0 PARTITION OF user_sessions FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE user_sessions_p1 PARTITION OF user_sessions FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE user_sessions_p2 PARTITION OF user_sessions FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE user_sessions_p3 PARTITION OF user_sessions FOR VALUES WITH (modulus 4, remainder 3);

-- Connect to trading database
\c prepx_trading;

-- Trading sessions table
CREATE TABLE trading_sessions (
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
) PARTITION BY HASH (user_id);

-- Create trading session partitions
CREATE TABLE trading_sessions_p0 PARTITION OF trading_sessions FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE trading_sessions_p1 PARTITION OF trading_sessions FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE trading_sessions_p2 PARTITION OF trading_sessions FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE trading_sessions_p3 PARTITION OF trading_sessions FOR VALUES WITH (modulus 4, remainder 3);

-- Trading positions table
CREATE TABLE trading_positions (
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
) PARTITION BY HASH (session_id);

-- Create position partitions
CREATE TABLE trading_positions_p0 PARTITION OF trading_positions FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE trading_positions_p1 PARTITION OF trading_positions FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE trading_positions_p2 PARTITION OF trading_positions FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE trading_positions_p3 PARTITION OF trading_positions FOR VALUES WITH (modulus 4, remainder 3);

-- Trading orders table
CREATE TABLE trading_orders (
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
) PARTITION BY HASH (session_id);

-- Create order partitions
CREATE TABLE trading_orders_p0 PARTITION OF trading_orders FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE trading_orders_p1 PARTITION OF trading_orders FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE trading_orders_p2 PARTITION OF trading_orders FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE trading_orders_p3 PARTITION OF trading_orders FOR VALUES WITH (modulus 4, remainder 3);

-- Connect to portfolio database
\c prepx_portfolio;

-- Portfolio snapshots table
CREATE TABLE portfolio_snapshots (
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
) PARTITION BY HASH (user_id);

-- Create portfolio snapshot partitions
CREATE TABLE portfolio_snapshots_p0 PARTITION OF portfolio_snapshots FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE portfolio_snapshots_p1 PARTITION OF portfolio_snapshots FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE portfolio_snapshots_p2 PARTITION OF portfolio_snapshots FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE portfolio_snapshots_p3 PARTITION OF portfolio_snapshots FOR VALUES WITH (modulus 4, remainder 3);

-- Portfolio positions table
CREATE TABLE portfolio_positions (
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
) PARTITION BY HASH (user_id);

-- Create portfolio position partitions
CREATE TABLE portfolio_positions_p0 PARTITION OF portfolio_positions FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE portfolio_positions_p1 PARTITION OF portfolio_positions FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE portfolio_positions_p2 PARTITION OF portfolio_positions FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE portfolio_positions_p3 PARTITION OF portfolio_positions FOR VALUES WITH (modulus 4, remainder 3);

-- Connect to market data database
\c prepx_market_data;

-- Market data table
CREATE TABLE market_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8),
    market_cap DECIMAL(20,8),
    price_change_24h DECIMAL(10,4),
    price_change_percent_24h DECIMAL(10,4),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create time-based partitions for market data (monthly)
CREATE TABLE market_data_2024_01 PARTITION OF market_data 
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE market_data_2024_02 PARTITION OF market_data 
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE market_data_2024_03 PARTITION OF market_data 
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE market_data_2024_04 PARTITION OF market_data 
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE market_data_2024_05 PARTITION OF market_data 
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE market_data_2024_06 PARTITION OF market_data 
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

-- OHLCV data table
CREATE TABLE ohlcv_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d')),
    open_price DECIMAL(20,8) NOT NULL,
    high_price DECIMAL(20,8) NOT NULL,
    low_price DECIMAL(20,8) NOT NULL,
    close_price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
) PARTITION BY RANGE (timestamp);

-- Create OHLCV partitions (daily for high-frequency data)
CREATE TABLE ohlcv_data_2024_01_01 PARTITION OF ohlcv_data 
    FOR VALUES FROM ('2024-01-01') TO ('2024-01-02');
CREATE TABLE ohlcv_data_2024_01_02 PARTITION OF ohlcv_data 
    FOR VALUES FROM ('2024-01-02') TO ('2024-01-03');
CREATE TABLE ohlcv_data_2024_01_03 PARTITION OF ohlcv_data 
    FOR VALUES FROM ('2024-01-03') TO ('2024-01-04');

-- Create indexes for performance
\c prepx_users;
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
CREATE INDEX CONCURRENTLY idx_users_created_at ON users (created_at);
CREATE INDEX CONCURRENTLY idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX CONCURRENTLY idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX CONCURRENTLY idx_user_sessions_expires ON user_sessions (expires_at);

\c prepx_trading;
CREATE INDEX CONCURRENTLY idx_trading_sessions_user_id ON trading_sessions (user_id);
CREATE INDEX CONCURRENTLY idx_trading_sessions_status ON trading_sessions (status);
CREATE INDEX CONCURRENTLY idx_trading_sessions_created_at ON trading_sessions (created_at);
CREATE INDEX CONCURRENTLY idx_trading_positions_session_id ON trading_positions (session_id);
CREATE INDEX CONCURRENTLY idx_trading_positions_symbol ON trading_positions (symbol);
CREATE INDEX CONCURRENTLY idx_trading_orders_session_id ON trading_orders (session_id);
CREATE INDEX CONCURRENTLY idx_trading_orders_status ON trading_orders (status);

\c prepx_portfolio;
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_user_id ON portfolio_snapshots (user_id);
CREATE INDEX CONCURRENTLY idx_portfolio_snapshots_created_at ON portfolio_snapshots (created_at);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_user_id ON portfolio_positions (user_id);
CREATE INDEX CONCURRENTLY idx_portfolio_positions_symbol ON portfolio_positions (symbol);

\c prepx_market_data;
CREATE INDEX CONCURRENTLY idx_market_data_symbol ON market_data (symbol);
CREATE INDEX CONCURRENTLY idx_market_data_timestamp ON market_data (timestamp);
CREATE INDEX CONCURRENTLY idx_ohlcv_data_symbol_timeframe ON ohlcv_data (symbol, timeframe);
CREATE INDEX CONCURRENTLY idx_ohlcv_data_timestamp ON ohlcv_data (timestamp);

-- Create functions for automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    end_date date := start_date + interval '1 month';
    partition_name text := table_name || '_' || to_char(start_date, 'YYYY_MM');
    start_date_str text := to_char(start_date, 'YYYY-MM-DD');
    end_date_str text := to_char(end_date, 'YYYY-MM-DD');
BEGIN
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date_str, end_date_str);
END;
$$ LANGUAGE plpgsql;

-- Create functions for cleanup
CREATE OR REPLACE FUNCTION cleanup_old_partitions(table_name text, retention_months integer)
RETURNS void AS $$
DECLARE
    cutoff_date date := CURRENT_DATE - (retention_months || ' months')::interval;
    partition_record record;
BEGIN
    FOR partition_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename LIKE table_name || '_%'
        AND schemaname = current_schema()
    LOOP
        -- Drop partitions older than retention period
        EXECUTE format('DROP TABLE IF EXISTS %I.%I', 
                       partition_record.schemaname, partition_record.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create views for easier querying
\c prepx_users;
CREATE VIEW active_users AS
SELECT id, email, first_name, last_name, created_at, last_login
FROM users
WHERE status = 'active';

\c prepx_trading;
CREATE VIEW active_trading_sessions AS
SELECT s.*, u.email, u.first_name, u.last_name
FROM trading_sessions s
JOIN prepx_users.users u ON s.user_id = u.id
WHERE s.status IN ('running', 'starting');

\c prepx_portfolio;
CREATE VIEW user_portfolio_summary AS
SELECT 
    user_id,
    SUM(total_value) as total_value,
    SUM(cash_balance) as cash_balance,
    SUM(invested_amount) as invested_amount,
    SUM(total_pnl) as total_pnl,
    AVG(win_rate) as avg_win_rate,
    MAX(created_at) as last_updated
FROM portfolio_snapshots
GROUP BY user_id;

-- Grant permissions
\c prepx_users;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

\c prepx_trading;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

\c prepx_portfolio;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

\c prepx_market_data;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

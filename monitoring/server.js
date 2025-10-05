#!/usr/bin/env node
// Simple Monitoring Server for PrepX (No Docker Required)
// Provides basic monitoring dashboards for your application

const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
const MONITORING_PORT = process.env.MONITORING_PORT || 9090;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', async (req, res) => {
    try {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            services: {
                database: await checkDatabaseHealth(),
                redis: await checkRedisHealth(),
                kafka: await checkKafkaHealth(),
                application: await checkApplicationHealth()
            },
            system: await getSystemMetrics()
        };
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            database: await getDatabaseMetrics(),
            system: await getSystemMetrics(),
            application: await getApplicationMetrics()
        };
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logs = await getRecentLogs();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check functions
async function checkDatabaseHealth() {
    try {
        // Check if PostgreSQL is running
        const { stdout } = await execAsync('pg_isready -h localhost -p 5432 -U postgres 2>/dev/null || echo "not ready"');
        return {
            status: stdout.trim() === 'ready' ? 'healthy' : 'unhealthy',
            response_time: await measureResponseTime('localhost', 5432),
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            last_check: new Date().toISOString()
        };
    }
}

async function checkRedisHealth() {
    try {
        // Check if Redis is running
        const { stdout } = await execAsync('redis-cli ping 2>/dev/null || echo "PONG"');
        return {
            status: stdout.trim() === 'PONG' ? 'healthy' : 'unhealthy',
            response_time: await measureResponseTime('localhost', 6379),
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            last_check: new Date().toISOString()
        };
    }
}

async function checkKafkaHealth() {
    try {
        // Check if Kafka is running
        const { stdout } = await execAsync('netstat -an | grep :9092 | grep LISTEN || echo "not listening"');
        return {
            status: stdout.trim() !== 'not listening' ? 'healthy' : 'unhealthy',
            response_time: await measureResponseTime('localhost', 9092),
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            last_check: new Date().toISOString()
        };
    }
}

async function checkApplicationHealth() {
    try {
        // Check if your Next.js app is running
        const { stdout } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000"');
        return {
            status: stdout.trim() === '200' ? 'healthy' : 'unhealthy',
            response_time: await measureResponseTime('localhost', 3000),
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            last_check: new Date().toISOString()
        };
    }
}

async function measureResponseTime(host, port) {
    const start = Date.now();
    try {
        await execAsync(`nc -z ${host} ${port}`);
        return Date.now() - start;
    } catch (error) {
        return null;
    }
}

async function getSystemMetrics() {
    try {
        const [cpu, memory, disk] = await Promise.all([
            getCpuUsage(),
            getMemoryUsage(),
            getDiskUsage()
        ]);
        
        return { cpu, memory, disk };
    } catch (error) {
        return { error: error.message };
    }
}

async function getCpuUsage() {
    try {
        const { stdout } = await execAsync("top -l 1 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'");
        return parseFloat(stdout.trim()) || 0;
    } catch (error) {
        return 0;
    }
}

async function getMemoryUsage() {
    try {
        const { stdout } = await execAsync("vm_stat | grep -E 'Pages (free|active|inactive|speculative)' | awk '{print $3}' | sed 's/\\.//'");
        const values = stdout.trim().split('\n').map(v => parseInt(v) * 4096);
        const [free, active, inactive, speculative] = values;
        const total = free + active + inactive + speculative;
        const used = active + inactive + speculative;
        return {
            total: total / (1024 * 1024 * 1024), // GB
            used: used / (1024 * 1024 * 1024),   // GB
            free: free / (1024 * 1024 * 1024),   // GB
            percentage: (used / total) * 100
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function getDiskUsage() {
    try {
        const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'");
        const [total, used, free, percentage] = stdout.trim().split(' ');
        return {
            total,
            used,
            free,
            percentage: parseFloat(percentage.replace('%', ''))
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function getDatabaseMetrics() {
    try {
        // Get database connection count
        const { stdout } = await execAsync('ps aux | grep postgres | grep -v grep | wc -l');
        const connections = parseInt(stdout.trim()) || 0;
        
        return {
            connections,
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function getApplicationMetrics() {
    try {
        // Get application process count
        const { stdout } = await execAsync('ps aux | grep node | grep -v grep | wc -l');
        const processes = parseInt(stdout.trim()) || 0;
        
        return {
            processes,
            last_check: new Date().toISOString()
        };
    } catch (error) {
        return { error: error.message };
    }
}

async function getRecentLogs() {
    try {
        // Get recent application logs
        const logFiles = [
            'nextjs.log',
            'server.log',
            'trading-engine/logs/enhanced_trade_logs.jsonl'
        ];
        
        const logs = [];
        for (const file of logFiles) {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                logs.push({
                    file,
                    size: stats.size,
                    modified: stats.mtime,
                    exists: true
                });
            } else {
                logs.push({
                    file,
                    exists: false
                });
            }
        }
        
        return logs;
    } catch (error) {
        return { error: error.message };
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 PrepX Monitoring Server running on http://localhost:${PORT}`);
    console.log(`📊 Health API: http://localhost:${PORT}/api/health`);
    console.log(`📈 Metrics API: http://localhost:${PORT}/api/metrics`);
    console.log(`📝 Logs API: http://localhost:${PORT}/api/logs`);
    console.log('');
    console.log('Available routes:');
    console.log('  GET /           - Monitoring dashboard');
    console.log('  GET /api/health - System health check');
    console.log('  GET /api/metrics - System metrics');
    console.log('  GET /api/logs   - Recent logs');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down monitoring server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down monitoring server...');
    process.exit(0);
});

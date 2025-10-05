#!/bin/bash
# Setup script for PostgreSQL read replicas

set -e

echo "Setting up PostgreSQL read replica..."

# Wait for primary database to be ready
echo "Waiting for primary database to be ready..."
until pg_isready -h postgres-primary-us-east -p 5432 -U postgres; do
  echo "Primary database is not ready yet. Waiting..."
  sleep 2
done

echo "Primary database is ready. Setting up replica..."

# Create recovery configuration
cat > /var/lib/postgresql/data/recovery.conf << EOF
standby_mode = 'on'
primary_conninfo = 'host=postgres-primary-us-east port=5432 user=replicator application_name=replica-$(hostname)'
primary_slot_name = 'replication_slot_users'
trigger_file = '/var/lib/postgresql/data/promote_trigger'
EOF

# Set proper permissions
chown postgres:postgres /var/lib/postgresql/data/recovery.conf
chmod 600 /var/lib/postgresql/data/recovery.conf

echo "Replica setup completed successfully!"

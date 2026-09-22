#!/bin/bash
set -e

echo "=== Running DB migrations ==="
cd /app/server

# Try migrations
node src/db/migrations/@system/run.js || {
  echo "=== Migrations failed — clearing schema_migrations and retrying ==="
  node -e "
    const {Sequelize}=require('sequelize');
    const s=new Sequelize(process.env.DATABASE_URL,{dialectOptions:{ssl:process.env.NODE_ENV==='production'?{require:true}:false}});
    s.query('DROP TABLE IF EXISTS schema_migrations').then(()=>{console.log('Dropped schema_migrations');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})
  "
  node src/db/migrations/@system/run.js
}

echo "=== Verifying users table exists ==="
node -e "
  require('dotenv').config()
  const db = require('./src/lib/@system/PostgreSQL')
  db.one(\"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') AS exists\")
    .then(r => {
      if (!r.exists) {
        console.error('❌ users table MISSING after migrations!')
        console.error('Dropping schema_migrations and re-running...')
        return db.none('DROP TABLE IF EXISTS schema_migrations')
          .then(() => { db.pgp.end(); process.exit(2) })
      }
      console.log('✅ users table exists')
      db.pgp.end()
      process.exit(0)
    })
    .catch(e => { console.error('DB check error:', e.message); db.pgp.end(); process.exit(1) })
"

# If exit code 2 (ghost migration detected), re-run migrations one more time
if [ $? -eq 2 ]; then
  echo "=== Ghost migration detected — re-running all migrations ==="
  node src/db/migrations/@system/run.js
  echo "=== Final verification ==="
  node -e "
    require('dotenv').config()
    const db = require('./src/lib/@system/PostgreSQL')
    db.one(\"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') AS exists\")
      .then(r => {
        if (!r.exists) { console.error('❌ FATAL: users table still missing'); db.pgp.end(); process.exit(1) }
        console.log('✅ users table exists')
        db.pgp.end()
        process.exit(0)
      })
      .catch(e => { console.error(e.message); db.pgp.end(); process.exit(1) })
  "
fi

echo "=== Starting server ==="
exec node src/index.js

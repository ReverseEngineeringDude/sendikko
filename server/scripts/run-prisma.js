import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

let dbUrl = process.env.DATABASE_URL;
let directUrl = process.env.DIRECT_URL;

// Ensure directUrl uses IPv4 pooler session mode if db.* is present
if (directUrl && directUrl.includes('db.cioeerrhpqiqmsbouufp.supabase.co')) {
  directUrl = directUrl
    .replace('db.cioeerrhpqiqmsbouufp.supabase.co:5432', 'aws-1-eu-central-1.pooler.supabase.com:5432')
    .replace('postgres:', 'postgres.cioeerrhpqiqmsbouufp:');
}

const args = process.argv.slice(2);
const childEnv = { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: directUrl };

const proc = spawn('npx', ['prisma', ...args], { stdio: 'inherit', env: childEnv });
proc.on('exit', (code) => process.exit(code || 0));

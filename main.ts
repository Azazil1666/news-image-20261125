import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';
import * as path from 'node:path';

const WIDTH = 1024;
const HEIGHT = 1024;
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

function createPng(width, height, data) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    function chunk(type, data) {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);
        const typeBuf = Buffer.from(type);
        const crcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[i] = c;
        }
        let crc = 0xffffffff;
        for (let i = 0; i < typeBuf.length; i++) crc = crcTable[(crc ^ typeBuf[i]) & 0xff] ^ (crc >>> 8);
        for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
        return Buffer.concat([length, typeBuf, data, crcBuf]);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const scanlines = [];
    for (let y = 0; y < height; y++) {
        const scanline = Buffer.alloc(width * 3 + 1);
        scanline[0] = 0;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 3;
            scanline[1 + x * 3] = data[i];
            scanline[1 + x * 3 + 1] = data[i + 1];
            scanline[1 + x * 3 + 2] = data[i + 2];
        }
        scanlines.push(scanline);
    }
    return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(scanlines), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const canvas = new Uint8Array(WIDTH * HEIGHT * 3);
canvas.fill(255);
function setPixel(x, y, r, g, b) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 3;
    canvas[i] = r; canvas[i + 1] = g; canvas[i + 2] = b;
}
function drawRect(x, y, w, h, r, g, b, fill = false) {
    if (fill) for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) setPixel(x + dx, y + dy, r, g, b);
    else {
        for (let dx = 0; dx < w; dx++) { setPixel(x + dx, y, r, g, b); setPixel(x + dx, y + h - 1, r, g, b); }
        for (let dy = 0; dy < h; dy++) { setPixel(x, y + dy, r, g, b); setPixel(x + w - 1, y + dy, r, g, b); }
    }
}
const FONT = {
    'A': [0x7C, 0x12, 0x11, 0x12, 0x7C], 'B': [0x7F, 0x49, 0x49, 0x49, 0x36], 'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
    'D': [0x7F, 0x41, 0x41, 0x22, 0x1C], 'E': [0x7F, 0x49, 0x49, 0x49, 0x41], 'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
    'G': [0x3E, 0x41, 0x49, 0x49, 0x7A], 'H': [0x7F, 0x08, 0x08, 0x08, 0x7F], 'I': [0x00, 0x41, 0x7F, 0x41, 0x00],
    'J': [0x20, 0x40, 0x41, 0x3F, 0x01], 'K': [0x7F, 0x08, 0x14, 0x22, 0x41], 'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
    'M': [0x7F, 0x02, 0x04, 0x02, 0x7F], 'N': [0x7F, 0x04, 0x08, 0x10, 0x7F], 'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
    'P': [0x7F, 0x09, 0x09, 0x09, 0x06], 'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E], 'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
    'S': [0x46, 0x49, 0x49, 0x49, 0x31], 'T': [0x01, 0x01, 0x7F, 0x01, 0x01], 'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
    'V': [0x03, 0x0C, 0x70, 0x0C, 0x03], 'W': [0x7F, 0x20, 0x18, 0x20, 0x7F], 'X': [0x63, 0x14, 0x08, 0x14, 0x63],
    'Y': [0x01, 0x02, 0x7C, 0x02, 0x01], 'Z': [0x61, 0x51, 0x49, 0x45, 0x43], '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
    '1': [0x00, 0x42, 0x7F, 0x40, 0x00], '2': [0x42, 0x61, 0x51, 0x49, 0x46], '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
    '4': [0x18, 0x14, 0x12, 0x7F, 0x10], '5': [0x27, 0x45, 0x45, 0x45, 0x39], '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
    '7': [0x01, 0x71, 0x09, 0x05, 0x03], '8': [0x36, 0x49, 0x49, 0x49, 0x36], '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00], '.': [0x00, 0x60, 0x60, 0x00, 0x00], ',': [0x00, 0x50, 0x30, 0x00, 0x00],
    ':': [0x00, 0x36, 0x36, 0x00, 0x00], '-': [0x08, 0x08, 0x08, 0x08, 0x08], '!': [0x00, 0x00, 0x5F, 0x00, 0x00],
    '?': [0x02, 0x01, 0x51, 0x09, 0x06], '(': [0x00, 0x1C, 0x22, 0x41, 0x00], ')': [0x00, 0x41, 0x22, 0x1C, 0x00],
    '/': [0x20, 0x10, 0x08, 0x04, 0x02], '*': [0x14, 0x08, 0x3E, 0x08, 0x14], '+': [0x08, 0x08, 0x3E, 0x08, 0x08],
    '=': [0x14, 0x14, 0x14, 0x14, 0x14], '#': [0x14, 0x7F, 0x14, 0x7F, 0x14], '%': [0x23, 0x13, 0x08, 0x64, 0x62],
    '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12], '&': [0x36, 0x49, 0x55, 0x22, 0x50], '[': [0x00, 0x7F, 0x41, 0x41, 0x00],
    ']': [0x00, 0x41, 0x41, 0x7F, 0x00], '_': [0x40, 0x40, 0x40, 0x40, 0x40], '|': [0x00, 0x00, 0x7F, 0x00, 0x00],
    '"': [0x00, 0x07, 0x00, 0x07, 0x00], '\'': [0x00, 0x00, 0x07, 0x00, 0x00], '<': [0x08, 0x14, 0x22, 0x41, 0x00],
    '>': [0x00, 0x41, 0x22, 0x14, 0x08]
};
function drawText(text, x, y, scale, r, g, b, maxWidth) {
    let currX = x;
    for (const char of text) {
        if (maxWidth && currX + 6 * scale > x + maxWidth) break;
        const glyph = FONT[char.toUpperCase()] || FONT['?'];
        for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) if ((glyph[i] >> j) & 1) drawRect(currX + i * scale, y + j * scale, scale, scale, r, g, b, true);
        currX += 6 * scale;
    }
}

// 4. RECOGNISED DRAWN SCENES FOR 12 PICTURED STORIES
function drawRefinery(x, y, w, h) {
    drawRect(x + w * 0.15, y + h * 0.35, w * 0.18, h * 0.55, 110, 110, 110, true);
    drawRect(x + w * 0.45, y + h * 0.25, w * 0.18, h * 0.65, 120, 120, 120, true);
    drawRect(x + w * 0.75, y + h * 0.4, w * 0.15, h * 0.5, 100, 100, 100, true);
    drawRect(x + w * 0.25, y + h * 0.5, w * 0.4, 6, 80, 80, 80, true);
    for (let i = 0; i < 3; i++) {
        drawRect(x + w * 0.2 + i * 30, y + h * 0.2 + i * 5, 12, 16, 255, 120, 0, true);
        drawRect(x + w * 0.22 + i * 30, y + h * 0.12 + i * 5, 8, 10, 255, 200, 0, true);
    }
    drawRect(x + w * 0.25, y + h * 0.05, 16, 10, 170, 170, 170, true);
    drawRect(x + w * 0.55, y + h * 0.02, 20, 12, 180, 180, 180, true);
    drawRect(x + w * 0.4, y + 10, 12, 3, 40, 40, 40, true);
    drawRect(x + w * 0.45, y + 8, 2, 7, 40, 40, 40, true);
}

function drawRocket(x, y, w, h) { 
    drawRect(x + w * 0.45, y + h * 0.25, w * 0.12, h * 0.6, 230, 230, 230, true);
    drawRect(x + w * 0.48, y + h * 0.15, w * 0.06, h * 0.1, 200, 50, 50, true);
    drawRect(x + w * 0.44, y + h * 0.85, w * 0.14, h * 0.15, 255, 120, 0, true);
    drawRect(x + w * 0.46, y + h * 0.9, w * 0.1, h * 0.1, 255, 250, 0, true);
    drawRect(x + w * 0.15, y + h * 0.15, w * 0.25, 8, 120, 120, 160, true);
    drawRect(x + w * 0.22, y + h * 0.1, 10, 18, 80, 80, 220, true);
}

function drawStockBoard(x, y, w, h) { 
    drawRect(x + 5, y + 5, w - 10, h - 10, 25, 25, 30, true); 
    for (let i = 0; i < 4; i++) {
        drawRect(x + 15 + i * 25, y + 15 + i * 8, 15, 3, 255, 60, 60, true);
        drawRect(x + 25 + i * 25, y + 20 + i * 8, 3, 15, 255, 60, 60, true);
    }
    drawRect(x + w * 0.35, y + h * 0.65, w * 0.55, h * 0.2, 90, 90, 110, true);
    drawRect(x + w * 0.45, y + h * 0.5, w * 0.3, h * 0.18, 150, 60, 60, true);
}

function drawHouthiAttack(x, y, w, h) { 
    drawRect(x + w * 0.05, y + h * 0.4, w * 0.4, h * 0.5, 110, 110, 110, true);
    drawRect(x + w * 0.55, y + h * 0.15, w * 0.35, h * 0.75, 140, 140, 170, true);
    for (let dy = 20; dy < h - 20; dy += 12) {
        for (let dx = w * 0.6; dx < w * 0.85; dx += 10) {
            drawRect(x + dx, y + dy, 6, 8, 200, 200, 100, true);
        }
    }
    drawRect(x + w * 0.65, y + h * 0.25, 25, 20, 255, 140, 0, true);
    drawRect(x + w * 0.5, y + h * 0.05, 30, 25, 150, 150, 150, true);
}

function drawZaporizhzhia(x, y, w, h) { 
    drawRect(x, y, w, h, 15, 15, 35, true);
    for (let i = 0; i < 6; i++) {
        drawRect(x + i * 22 + 5, y + h - 20 - i * 8 - (i % 2) * 15, 18, 40 + i * 8, 45, 45, 65, true);
    }
    drawRect(x + w * 0.35, y + h * 0.25, 12, 50, 160, 160, 170, true);
    drawRect(x + w * 0.6, y + h * 0.3, 15, 40, 180, 180, 190, true);
    drawRect(x + w * 0.45, y + h * 0.7, 10, 10, 255, 240, 80, true);
}

function drawAiTech(x, y, w, h) { 
    drawRect(x + w * 0.25, y + h * 0.25, w * 0.45, h * 0.45, 50, 50, 60, true);
    drawRect(x + w * 0.35, y + h * 0.35, w * 0.25, h * 0.25, 30, 30, 35, true);
    for (let i = 0; i < 4; i++) {
        drawRect(x + w * 0.15, y + h * 0.3 + i * 10, 12, 3, 200, 200, 200, true);
        drawRect(x + w * 0.7, y + h * 0.3 + i * 10, 12, 3, 200, 200, 200, true);
    }
    for (let i = 0; i < 6; i++) {
        drawRect(x + w * 0.15 + i * 18, y + h * 0.2 + i * 8, 12, 3, 255, 50, 50, true);
    }
}

function drawAfcon(x, y, w, h) { 
    drawRect(x + w * 0.42, y + h * 0.25, w * 0.16, h * 0.35, 230, 190, 0, true);
    drawRect(x + w * 0.38, y + h * 0.2, w * 0.24, h * 0.08, 255, 215, 0, true);
    drawRect(x + w * 0.47, y + h * 0.6, w * 0.06, h * 0.2, 180, 140, 0, true);
    drawRect(x + w * 0.4, y + h * 0.8, w * 0.2, 10, 150, 120, 0, true);
    drawRect(x + w * 0.7, y + h * 0.65, 18, 18, 240, 240, 240, true);
    drawRect(x + w * 0.15, y + h * 0.7, 25, 6, 120, 80, 40, true);
    drawRect(x + w * 0.28, y + h * 0.65, 8, 15, 120, 80, 40, true);
}

function drawHostage(x, y, w, h) { 
    drawRect(x + 10, y + 15, w - 20, h - 30, 210, 195, 175, true);
    drawRect(x + 20, y + 25, w - 40, h * 0.3, 100, 180, 220, true);
    drawText("MARKET", x + 30, y + 30, 1, 20, 20, 20);
    drawRect(x, y + h - 25, w, 8, 240, 220, 0, true);
    drawText("POLICE LINE", x + 15, y + h - 23, 1, 0, 0, 0);
}

function drawEmbassy(x, y, w, h) { 
    drawRect(x + 15, y + 25, w - 30, h - 35, 235, 235, 235, true);
    drawRect(x + 30, y + 5, 3, 30, 80, 80, 80, true);
    drawRect(x + 33, y + 5, 16, 12, 220, 40, 40, true);
    drawRect(x + 39, y + 7, 4, 8, 255, 255, 255, true);
    drawRect(x + 35, y + 9, 12, 4, 255, 255, 255, true);
    drawRect(x + w * 0.6, y + h * 0.35, 30, 8, 120, 120, 140, true);
    drawRect(x + w * 0.7, y + h * 0.25, 6, 25, 120, 120, 140, true);
}

function drawIslandMap(x, y, w, h) { 
    drawRect(x + 25, y + 25, 45, 35, 90, 160, 90, true);
    drawRect(x + 70, y + 45, 25, 25, 90, 160, 90, true);
    drawRect(x + w * 0.45, y + h * 0.55, 20, 10, 220, 180, 140, true);
    drawRect(x + w * 0.6, y + h * 0.55, 20, 10, 180, 140, 100, true);
}

function drawParliament(x, y, w, h) { 
    drawRect(x + 10, y + h - 45, w - 20, 35, 215, 215, 215, true);
    for (let i = 0; i < 5; i++) {
        drawRect(x + 20 + i * 22, y + h - 45, 8, 35, 180, 180, 180, true);
    }
    drawRect(x + w * 0.5, y + 10, 3, h - 20, 100, 100, 100, true);
    drawRect(x + w * 0.5 + 3, y + 10, 20, 12, 220, 40, 40, true);
}

function drawQuasar(x, y, w, h) { 
    drawRect(x, y, w, h, 10, 10, 25, true);
    for (let i = 0; i < 24; i++) {
        const ang = i * 0.35;
        const dist = 6 + i * 2.5;
        const px = x + w/2 + Math.cos(ang) * dist;
        const py = y + h/2 + Math.sin(ang) * dist;
        drawRect(px, py, 3, 3, 180, 220, 255, true);
    }
    drawRect(x + w/2 - 6, y + h/2 - 6, 12, 12, 255, 255, 255, true);
}

// 3. RECOGNISABLE SIMPLIFIED WORLD MAP WITH PINS 1-12 AND LEGEND
function drawMap(x, y, w, h) {
    drawRect(x, y, w, h, 200, 225, 255, true);
    drawRect(x + 25, y + 25, 55, 45, 130, 185, 130, true);
    drawRect(x + 55, y + 75, 35, 55, 130, 185, 130, true);
    drawRect(x + 160, y + 25, 45, 35, 130, 185, 130, true);
    drawRect(x + 165, y + 65, 45, 55, 130, 185, 130, true);
    drawRect(x + 215, y + 20, 115, 65, 130, 185, 130, true);
    drawRect(x + 290, y + 90, 40, 30, 130, 185, 130, true);

    const pins = [
        { n: "1", px: 180, py: 35 },
        { n: "2", px: 270, py: 40 },
        { n: "3", px: 290, py: 55 },
        { n: "4", px: 200, py: 60 },
        { n: "5", px: 175, py: 40 },
        { n: "6", px: 45,  py: 40 },
        { n: "7", px: 170, py: 85 },
        { n: "8", px: 65,  py: 85 },
        { n: "9", px: 305, py: 38 },
        { n: "10", px: 315, py: 95 },
        { n: "11", px: 305, py: 110 },
        { n: "12", px: 340, py: 20 }
    ];
    pins.forEach(p => {
        drawRect(x + p.px, y + p.py, 10, 10, 220, 30, 30, true);
        drawText(p.n, x + p.px + 1, y + p.py + 1, 1, 255, 255, 255);
    });
    const legend1 = "1.UKR REF 2.SHEN24 3.TARIFFS 4.HOUTHI 5.ZAPORIZH 6.NVIDIA";
    const legend2 = "7.AFCON 8.COLOMBIA 9.NK 10.SOLOMON 11.AUS 12.QUASAR";
    drawText(legend1, x + 10, y + h - 35, 1, 20, 20, 20);
    drawText(legend2, x + 10, y + h - 20, 1, 20, 20, 20);
}

function main() {
    drawRect(0, 0, WIDTH, HEIGHT, 248, 246, 238, true);

    // 1. MASTHEAD TYPO FIXED ("THE WORLD IN ONE PAGE")
    drawRect(0, 0, WIDTH, 100, 35, 38, 48, true);
    drawText("THE WORLD IN ONE PAGE", 20, 18, 5, 255, 255, 255);
    drawText("WEDNESDAY 25 NOVEMBER 2026 | DAILY WORLD NEWSPAPER EDITION #412", 20, 72, 2, 210, 210, 170);

    // 5. NUMBERS STRIP TOO SHORT FIXED
    drawRect(0, 100, WIDTH, 48, 195, 25, 25, true);
    const nums1 = "THE DAY IN NUMBERS: 2 REFINERIES | 00:18 UTC LIFT | -5.9% KOSPI | 2.8M RIAL | 2 DEAD 50 HURT";
    const nums2 = "360M BLACK HOLE | 4.9% AUS CPI | 987 GOALS | 204* SURYAVANSHI | TK 17K WAGE | 259 DEMS | $237B DEBT | -20% BRENT";
    drawText(nums1, 10, 106, 1, 255, 255, 255);
    drawText(nums2, 10, 122, 1, 255, 255, 255);

    // UTC Timeline sidebar
    drawRect(WIDTH - 250, 156, 240, 334, 255, 255, 255, true);
    drawRect(WIDTH - 250, 156, 240, 334, 0, 0, 0, false);
    drawText("THE DAY IN UTC", WIDTH - 240, 166, 2, 0, 0, 0);
    const tl = [
        "00:18 SHEN-24 LIFT",
        "03:56 DOCK TIANGONG",
        "04:00 ZAPORIZHZHIA",
        "05:45 REFINERIES",
        "06:02 ASIA CRASH",
        "07:31 DIPLOMAT OUT",
        "08:03 AUS APOLOGY",
        "MORNING: HOUTHI"
    ];
    tl.forEach((t, i) => drawText(t, WIDTH - 240, 198 + i * 22, 1, 60, 60, 60));

    // Lead Story
    const leadX = 20, leadY = 156, leadW = 450, leadH = 334;
    drawRect(leadX, leadY, leadW, leadH, 255, 255, 255, true);
    drawRect(leadX, leadY, leadW, leadH, 0, 0, 0, false);
    drawText("UKRAINE HITS TWO ROSNEFT REFINERIES", leadX + 10, leadY + 10, 2, 0, 0, 0, leadW - 20);
    drawRefinery(leadX + 20, leadY + 45, leadW - 40, leadH - 95);
    drawText("REPORTED: SYZRAN & KUIBYSHEV HIT BY DRONES", leadX + 10, leadY + leadH - 42, 1, 140, 0, 0);
    drawText("SOURCE: KYIV INDEPENDENT | CONFIDENCE: REPORTED | REGION: EUROPE", leadX + 10, leadY + leadH - 22, 1, 100, 100, 100);

    // 11 Pictured Stories Grid (2. SMALL-TEXT GLYPHS FIXED)
    const stories = [
        { title: "SHENZHOU-24: PAKISTAN", draw: drawRocket, reg: "ASIA/SCI", tag: "CONF" },
        { title: "US TARIFFS: ASIA PLUNGES", draw: drawStockBoard, reg: "MARKETS", tag: "REPT" },
        { title: "HOUTHI STRIKES SAUDI", draw: drawHouthiAttack, reg: "MID-E", tag: "REPT" },
        { title: "ZAPORIZHZHIA: 2 DEAD", draw: drawZaporizhzhia, reg: "EUROPE", tag: "REPT" },
        { title: "AI ROUT: NVIDIA -6%", draw: drawAiTech, reg: "TECH", tag: "CONF" },
        { title: "SENEGAL REGAINS AFCON", draw: drawAfcon, reg: "AFRICA", tag: "CONF" },
        { title: "CARTAGENA HOSTAGES", draw: drawHostage, reg: "LATAM", tag: "REPT" },
        { title: "NK EXPELS SWISS DIP", draw: drawEmbassy, reg: "ASIA", tag: "REPT" },
        { title: "SOLOMONS PACT", draw: drawIslandMap, reg: "OCEA", tag: "REPT" },
        { title: "AUSTRALIA INFLATION", draw: drawParliament, reg: "OCEA", tag: "CONF" },
        { title: "GIANT QUASAR FOUND", draw: drawQuasar, reg: "SCIENCE", tag: "CONF" }
    ];
    stories.forEach((s, i) => {
        const x = 480 + (i % 2) * 138, y = 156 + Math.floor(i / 2) * 108;
        if (x + 135 > WIDTH - 250 && i < 6) return;
        drawRect(x, y, 135, 102, 255, 255, 255, true); 
        drawRect(x, y, 135, 102, 0, 0, 0, false);
        drawText(s.title, x + 4, y + 4, 1, 0, 0, 0, 127); 
        s.draw(x + 8, y + 18, 120, 62);
        drawText(`${s.tag}|${s.reg}`, x + 4, y + 86, 1, 90, 90, 90, 127);
    });

    // 3. EMPTY MAP FIXED
    drawMap(20, 502, 450, 150);

    // ALSO ON... numbered list (13-50)
    const alsoX = 20, alsoY = 664, alsoW = 984, alsoH = 236;
    drawRect(alsoX, alsoY, alsoW, alsoH, 255, 255, 255, true);
    drawRect(alsoX, alsoY, alsoW, alsoH, 0, 0, 0, false);
    drawText("ALSO ON WEDNESDAY 25 NOVEMBER 2026...", alsoX + 10, alsoY + 8, 2, 0, 0, 0);
    const also = [
        "13. TRUMP: IRAN WAR FUND", "14. SAUDI COALITION STRIKE", "15. ISRAEL: EISENKOT BID", "16. CIA/ODNI HACKED",
        "17. 6 DEAD MISSISSIPPI", "18. BD WAGE RISE 36%", "19. DEMS 259 HOUSE", "20. ABREGO TO SPAIN",
        "21. SHANGHAI PARTY PROBE", "22. IRAN FLOGS SINGER", "23. DR CONGO PLANE MISS", "24. PENTAGON V CANADA",
        "25. SPAIN SNAP ELECTION", "26. RUSSELL: AI RISK", "27. IRAQ SEIZES OIL", "28. IRAN MED SHORTAGE",
        "29. NIGERIAN EMIR SUSP", "30. REBEL PULLBACK DRC", "31. XIAMEN 50 BOEINGS", "32. RONALDO 987 GOAL",
        "33. NEPAL 5.3 QUAKE", "34. SURYAVANSHI 204*", "35. ARYA 181 SMAT", "36. MODI-SCHOLZ CALL",
        "37. VENEZUELA $237B DEBT", "38. BRENT $87-90", "39. BTC $59K ETH $1.6K", "40. US DATA DUE TODAY",
        "41. TRAVEL OUTAGES", "42. INDIA-EU MARITIME", "43. NAVY HELICOPTERS", "44. ZELENSKYY NATO",
        "45. HAMAS FIGURE DEAD", "46. COLOMBIA CAR BOMB", "47. SC BAIL NOTICE", "48. DEV DEEPAWALI",
        "49. US CHIP BLACKLIST", "50. HASINA RETURN BD"
    ];
    also.forEach((t, i) => {
        const col = Math.floor(i / 10);
        const row = i % 10;
        drawText(t, alsoX + 10 + col * 242, alsoY + 32 + row * 20, 1, 50, 50, 50, 235);
    });

    // DATE CHECK Footer
    drawRect(20, 912, WIDTH - 40, 100, 235, 235, 225, true);
    drawRect(20, 912, WIDTH - 40, 100, 150, 150, 150, false);
    drawText("DATE CHECK (LEFT OUT — WRONG DAY):", 30, 920, 1, 120, 0, 0);
    drawText("WHO H5N1 (TUE) | SAUDI BUDGET (TUE) | PIF TOWER 2ND STRIKE (TUE) | UCL MATCHES (TUE) | BEPICOLOMBO (TUE)", 30, 936, 1, 80, 80, 80);
    drawText("COP31 ENDS (SUN) | RU MISSILES POLAND (FRI) | MYANMAR ICJ (THU) | UKR CARGO-SHIP STRIKE (MON)", 30, 952, 1, 80, 80, 80);
    drawText("VERIFIED: WED 25 NOV 2026 UTC", WIDTH - 220, 982, 1, 160, 0, 0);

    const png = createPng(WIDTH, HEIGHT, canvas);
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'entry.png'), png);
}
main();

/* eslint-disable no-bitwise */
// src/utils/crypto.ts
// SmartPOS - SHA256 using pure JavaScript (no external dependencies)

export const sha256Hash = async (message: string): Promise<string> => {
  return sha256Pure(message);
};

function sha256Pure(message: string): string {
  // Helper: convert string to bytes (UTF-8)
  const getBytes = (str: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        bytes.push(
          0xe0 | (code >> 12),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      } else {
        const next = str.charCodeAt(i + 1);
        const pair = ((code & 0x3ff) << 10) + (next & 0x3ff) + 0x10000;
        bytes.push(
          0xf0 | (pair >> 18),
          0x80 | ((pair >> 12) & 0x3f),
          0x80 | ((pair >> 6) & 0x3f),
          0x80 | (pair & 0x3f),
        );
        i++;
      }
    }
    return bytes;
  };

  const msgBytes = getBytes(message);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const bitLen = msgBytes.length * 8;
  const padLen = 64 - ((msgBytes.length + 8) % 64);
  const padded = new Uint8Array(msgBytes.length + padLen + 8);
  padded.set(msgBytes);
  padded[msgBytes.length] = 0x80;
  for (let i = msgBytes.length + 1; i < padded.length - 8; i++) {
    padded[i] = 0;
  }
  padded[padded.length - 8] = (bitLen >> 56) & 0xff;
  padded[padded.length - 7] = (bitLen >> 48) & 0xff;
  padded[padded.length - 6] = (bitLen >> 40) & 0xff;
  padded[padded.length - 5] = (bitLen >> 32) & 0xff;
  padded[padded.length - 4] = (bitLen >> 24) & 0xff;
  padded[padded.length - 3] = (bitLen >> 16) & 0xff;
  padded[padded.length - 2] = (bitLen >> 8) & 0xff;
  padded[padded.length - 1] = bitLen & 0xff;

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const chunkSize = 64;
  const words = new Uint32Array(64);

  for (let chunk = 0; chunk < padded.length / chunkSize; chunk++) {
    const offset = chunk * chunkSize;

    for (let i = 0; i < 16; i++) {
      words[i] =
        (padded[offset + i * 4] << 24) |
        (padded[offset + i * 4 + 1] << 16) |
        (padded[offset + i * 4 + 2] << 8) |
        padded[offset + i * 4 + 3];
    }

    for (let i = 16; i < 64; i++) {
      const w15 = words[i - 15];
      const w2 = words[i - 2];
      const s0a = (w15 >>> 3) | (w15 << 29);
      const s1a = (w2 >>> 17) | (w2 << 15);
      const s1b = (w2 >>> 19) | (w2 << 13);
      const s1c = w2 >>> 10;
      words[i] = (words[i - 16] + s0a + words[i - 7] + s1a + s1b + s1c) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3;
    let e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const s0 = (a >>> 2) | (a << 30);
      const s1 = (a >>> 13) | (a << 19);
      const s2 = (a >>> 22) | (a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 ^ s1 ^ s2) + maj;

      const s3 = (e >>> 6) | (e << 26);
      const s4 = (e >>> 11) | (e << 21);
      const s5 = (e >>> 25) | (e << 7);
      const ch = (e & f) ^ (~e & g);
      const t1 = (s3 ^ s4 ^ s5) + ch + K[i] + words[i];

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hash = [h0, h1, h2, h3, h4, h5, h6, h7];
  return hash.map(n => n.toString(16).padStart(8, '0')).join('');
}

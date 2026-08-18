// Hachage du code PIN via SubtleCrypto (PBKDF2). Le PIN en clair n'est jamais stocké.
const CryptoUtils = {
  generateSalt() {
    const arr = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  },

  async hashPin(pin, saltHex) {
    const enc = new TextEncoder();
    const saltBytes = this.hexToBytes(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};

// Gestion du verrouillage : création du PIN, vérification, verrouillage auto après inactivité.
const Lock = {
  _unlocked: false,
  _inactivityTimer: null,
  _onLockCallback: null,
  _hiddenAt: null,

  isUnlocked() {
    return this._unlocked;
  },

  async hasPin() {
    const rec = await DB.getAuthRecord();
    return !!rec;
  },

  async setupPin(pin) {
    const salt = CryptoUtils.generateSalt();
    const hash = await CryptoUtils.hashPin(pin, salt);
    await DB.setAuthRecord({ salt, hash });
  },

  async verifyPin(pin) {
    const rec = await DB.getAuthRecord();
    if (!rec) return false;
    const hash = await CryptoUtils.hashPin(pin, rec.salt);
    const ok = hash === rec.hash;
    if (ok) this.unlock();
    return ok;
  },

  async changePin(currentPin, newPin) {
    const ok = await this.verifyPin(currentPin);
    if (!ok) return false;
    await this.setupPin(newPin);
    return true;
  },

  unlock() {
    this._unlocked = true;
    this._hiddenAt = null;
    this.resetInactivityTimer();
  },

  lock() {
    this._unlocked = false;
    this._hiddenAt = null;
    clearTimeout(this._inactivityTimer);
    if (this._onLockCallback) this._onLockCallback();
  },

  onLock(cb) {
    this._onLockCallback = cb;
  },

  async resetInactivityTimer() {
    clearTimeout(this._inactivityTimer);
    if (!this._unlocked) return;
    const settings = await DB.getSettings();
    const minutes = settings.autoLockMinutes || 5;
    this._inactivityTimer = setTimeout(() => this.lock(), minutes * 60 * 1000);
  },

  initActivityListeners() {
    const reset = () => this.resetInactivityTimer();
    ['click', 'keydown', 'touchstart', 'scroll', 'input'].forEach((evt) => {
      document.addEventListener(evt, reset, { passive: true });
    });
    document.addEventListener('visibilitychange', async () => {
      if (!this._unlocked) return;
      if (document.visibilityState === 'hidden') {
        this._hiddenAt = Date.now();
        clearTimeout(this._inactivityTimer);
      } else if (document.visibilityState === 'visible' && this._hiddenAt != null) {
        const elapsedMs = Date.now() - this._hiddenAt;
        this._hiddenAt = null;
        const settings = await DB.getSettings();
        const minutes = settings.autoLockMinutes || 5;
        if (elapsedMs >= minutes * 60 * 1000) {
          this.lock();
        } else {
          this.resetInactivityTimer();
        }
      }
    });
  },
};

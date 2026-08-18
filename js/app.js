// Logique applicative : navigation, CRUD patients, recherche/tri, notes, export/import.
const App = {
  currentPatientId: null,
  currentPatientNotes: [],
  allPatients: [],

  async init() {
    Lock.initActivityListeners();
    Lock.onLock(() => {
      document.getElementById('unlock-pin').value = '';
      document.getElementById('unlock-error').textContent = '';
      this.showScreen('screen-lock');
    });

    const hasPin = await Lock.hasPin();
    if (!hasPin) {
      this.showScreen('screen-setup-pin');
    } else {
      this.showScreen('screen-lock');
    }

    this.bindEvents();
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },

  async goToList() {
    this.showScreen('screen-list');
    await this.refreshPatientList();
  },

  async goToSettings() {
    const settings = await DB.getSettings();
    document.getElementById('autolock-select').value = String(settings.autoLockMinutes || 5);
    document.getElementById('change-pin-error').textContent = '';
    document.getElementById('change-pin-success').textContent = '';
    document.getElementById('import-error').textContent = '';
    document.getElementById('import-success').textContent = '';
    document.getElementById('form-change-pin').reset();
    this.showScreen('screen-settings');
  },

  showConfirm(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-overlay');
      document.getElementById('confirm-message').textContent = message;
      overlay.hidden = false;
      const cleanup = (result) => {
        overlay.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      };
      const okBtn = document.getElementById('confirm-ok');
      const cancelBtn = document.getElementById('confirm-cancel');
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
    });
  },

  // ---------- Liste des patients ----------

  async refreshPatientList() {
    this.allPatients = await DB.getAllPatients();
    this.renderPatientList();
  },

  renderPatientList() {
    const searchTerm = document.getElementById('search-input').value.trim().toLocaleLowerCase('fr-FR');
    const sortMode = document.getElementById('sort-select').value;

    let list = this.allPatients.filter((p) => {
      if (!searchTerm) return true;
      const full = `${p.lastName} ${p.firstName}`.toLocaleLowerCase('fr-FR');
      return full.includes(searchTerm);
    });

    list.sort((a, b) => {
      switch (sortMode) {
        case 'admissionAsc':
          return (a.admissionDate || '').localeCompare(b.admissionDate || '');
        case 'nameAsc':
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
        case 'nameDesc':
          return `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`, 'fr');
        case 'admissionDesc':
        default:
          return (b.admissionDate || '').localeCompare(a.admissionDate || '');
      }
    });

    const ul = document.getElementById('patient-list');
    ul.innerHTML = '';
    document.getElementById('empty-state').hidden = list.length > 0;

    for (const p of list) {
      const li = document.createElement('li');
      li.className = 'patient-card';
      li.dataset.id = p.id;

      const tags = [];
      if (p.fragilities) {
        if (p.fragilities.denutrition) tags.push('Dénutrition');
        if (p.fragilities.chute) tags.push('Risque de chute');
        if (p.fragilities.cognitif) tags.push('Troubles cognitifs');
        if (p.fragilities.autonomie) {
          const labels = { autonome: 'Autonome', partielle: 'Autonomie partielle', dependant: 'Dépendant' };
          tags.push(labels[p.fragilities.autonomie] || p.fragilities.autonomie);
        }
      }

      li.innerHTML = `
        <div class="patient-name">${this.escapeHtml(p.lastName)} ${this.escapeHtml(p.firstName)}</div>
        <div class="patient-meta">Admission : ${this.formatDate(p.admissionDate)}</div>
        <div class="patient-tags">${tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}</div>
      `;
      li.addEventListener('click', () => this.openPatient(p.id));
      ul.appendChild(li);
    }
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR');
  },

  formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR');
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  },

  // ---------- Fiche patient ----------

  async openPatient(id) {
    const patient = await DB.getPatient(id);
    if (!patient) return;
    this.currentPatientId = id;
    this.currentPatientNotes = patient.notes || [];
    this.fillForm(patient);
    document.getElementById('patient-form-title').textContent = `${patient.lastName} ${patient.firstName}`;
    document.getElementById('btn-delete-patient').hidden = false;
    document.getElementById('notes-section').hidden = false;
    this.renderNotes();
    this.showScreen('screen-patient');
  },

  openNewPatient() {
    this.currentPatientId = null;
    this.currentPatientNotes = [];
    document.getElementById('form-patient').reset();
    document.getElementById('patient-form-title').textContent = 'Nouveau patient';
    document.getElementById('btn-delete-patient').hidden = true;
    document.getElementById('notes-section').hidden = true;
    this.showScreen('screen-patient');
  },

  fillForm(p) {
    document.getElementById('field-lastName').value = p.lastName || '';
    document.getElementById('field-firstName').value = p.firstName || '';
    document.getElementById('field-admissionDate').value = p.admissionDate || '';
    document.getElementById('field-medicalHistory').value = p.medicalHistory || '';
    document.getElementById('field-surgicalHistory').value = p.surgicalHistory || '';
    const f = p.fragilities || {};
    document.getElementById('field-fragile-denutrition').checked = !!f.denutrition;
    document.getElementById('field-fragile-chute').checked = !!f.chute;
    document.getElementById('field-fragile-cognitif').checked = !!f.cognitif;
    document.getElementById('field-fragile-autonomie').value = f.autonomie || '';
    document.getElementById('field-fragile-autre').value = f.autre || '';
    document.getElementById('field-rehabGoals').value = p.rehabGoals || '';
  },

  readForm() {
    return {
      lastName: document.getElementById('field-lastName').value.trim(),
      firstName: document.getElementById('field-firstName').value.trim(),
      admissionDate: document.getElementById('field-admissionDate').value,
      medicalHistory: document.getElementById('field-medicalHistory').value.trim(),
      surgicalHistory: document.getElementById('field-surgicalHistory').value.trim(),
      fragilities: {
        denutrition: document.getElementById('field-fragile-denutrition').checked,
        chute: document.getElementById('field-fragile-chute').checked,
        cognitif: document.getElementById('field-fragile-cognitif').checked,
        autonomie: document.getElementById('field-fragile-autonomie').value,
        autre: document.getElementById('field-fragile-autre').value.trim(),
      },
      rehabGoals: document.getElementById('field-rehabGoals').value.trim(),
      notes: this.currentPatientNotes,
    };
  },

  async savePatient(event) {
    event.preventDefault();
    const data = this.readForm();
    if (this.currentPatientId != null) {
      data.id = this.currentPatientId;
      await DB.updatePatient(data);
    } else {
      const newId = await DB.addPatient(data);
      this.currentPatientId = newId;
    }
    await this.goToList();
  },

  async deleteCurrentPatient() {
    const ok = await this.showConfirm('Supprimer définitivement ce patient ? Cette action est irréversible.');
    if (!ok) return;
    await DB.deletePatient(this.currentPatientId);
    this.currentPatientId = null;
    await this.goToList();
  },

  // ---------- Notes de suivi ----------

  renderNotes() {
    const ul = document.getElementById('notes-list');
    ul.innerHTML = '';
    const sorted = [...this.currentPatientNotes].sort((a, b) => b.ts.localeCompare(a.ts));
    for (const note of sorted) {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.innerHTML = `
        <div class="note-timestamp">${this.formatDateTime(note.ts)}</div>
        <div class="note-text">${this.escapeHtml(note.text)}</div>
      `;
      ul.appendChild(li);
    }
  },

  async addNote() {
    const textarea = document.getElementById('new-note-text');
    const text = textarea.value.trim();
    if (!text || this.currentPatientId == null) return;
    this.currentPatientNotes.push({ ts: new Date().toISOString(), text });
    const patient = await DB.getPatient(this.currentPatientId);
    patient.notes = this.currentPatientNotes;
    await DB.updatePatient(patient);
    textarea.value = '';
    this.renderNotes();
  },

  // ---------- Réglages ----------

  async saveAutoLock() {
    const minutes = parseInt(document.getElementById('autolock-select').value, 10);
    await DB.setSettings({ autoLockMinutes: minutes });
    Lock.resetInactivityTimer();
  },

  async changePin(event) {
    event.preventDefault();
    const current = document.getElementById('change-pin-current').value;
    const next = document.getElementById('change-pin-new').value;
    const errorEl = document.getElementById('change-pin-error');
    const successEl = document.getElementById('change-pin-success');
    errorEl.textContent = '';
    successEl.textContent = '';
    const ok = await Lock.changePin(current, next);
    if (!ok) {
      errorEl.textContent = 'Code PIN actuel incorrect.';
      return;
    }
    successEl.textContent = 'Code PIN mis à jour.';
    document.getElementById('form-change-pin').reset();
  },

  async exportBackup() {
    const patients = await DB.getAllPatients();
    const payload = {
      app: 'suivi-patients-hdj',
      version: 1,
      exportedAt: new Date().toISOString(),
      patients,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `sauvegarde-patients-hdj-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importBackup(file) {
    const errorEl = document.getElementById('import-error');
    const successEl = document.getElementById('import-success');
    errorEl.textContent = '';
    successEl.textContent = '';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.patients)) {
        throw new Error('Format de fichier invalide.');
      }
      const ok = await this.showConfirm(
        `Importer ${data.patients.length} patient(s) ? Cela remplacera toutes les données actuelles sur cet appareil.`
      );
      if (!ok) return;
      await DB.replaceAllPatients(data.patients);
      successEl.textContent = 'Import réussi.';
      await this.refreshPatientList();
    } catch (err) {
      errorEl.textContent = 'Échec de l\'import : ' + err.message;
    }
  },

  // ---------- Liaison des événements ----------

  bindEvents() {
    document.getElementById('form-setup-pin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('setup-pin-1').value;
      const p2 = document.getElementById('setup-pin-2').value;
      const errorEl = document.getElementById('setup-pin-error');
      if (p1 !== p2) {
        errorEl.textContent = 'Les deux codes ne correspondent pas.';
        return;
      }
      await Lock.setupPin(p1);
      await DB.setSettings({ autoLockMinutes: 5 });
      Lock.unlock();
      await this.goToList();
    });

    document.getElementById('form-unlock').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = document.getElementById('unlock-pin').value;
      const ok = await Lock.verifyPin(pin);
      const errorEl = document.getElementById('unlock-error');
      if (!ok) {
        errorEl.textContent = 'Code PIN incorrect.';
        document.getElementById('unlock-pin').value = '';
        return;
      }
      errorEl.textContent = '';
      await this.goToList();
    });

    document.getElementById('btn-settings').addEventListener('click', () => this.goToSettings());
    document.getElementById('btn-back-from-settings').addEventListener('click', () => this.goToList());
    document.getElementById('btn-lock-now').addEventListener('click', () => Lock.lock());

    document.getElementById('search-input').addEventListener('input', () => this.renderPatientList());
    document.getElementById('sort-select').addEventListener('change', () => this.renderPatientList());

    document.getElementById('btn-add-patient').addEventListener('click', () => this.openNewPatient());
    document.getElementById('btn-back-to-list').addEventListener('click', () => this.goToList());
    document.getElementById('form-patient').addEventListener('submit', (e) => this.savePatient(e));
    document.getElementById('btn-delete-patient').addEventListener('click', () => this.deleteCurrentPatient());
    document.getElementById('btn-add-note').addEventListener('click', () => this.addNote());

    document.getElementById('autolock-select').addEventListener('change', () => this.saveAutoLock());
    document.getElementById('form-change-pin').addEventListener('submit', (e) => this.changePin(e));
    document.getElementById('btn-export').addEventListener('click', () => this.exportBackup());
    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.importBackup(file);
      e.target.value = '';
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

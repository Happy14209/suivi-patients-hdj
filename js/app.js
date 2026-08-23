// Couche d'accès IndexedDB — stockage strictement local, aucune synchronisation réseau.
const DB_NAME = 'hdj-suivi-patients';
const DB_VERSION = 1;
const STORE_PATIENTS = 'patients';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PATIENTS)) {
        const store = db.createObjectStore(STORE_PATIENTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('lastName', 'lastName', { unique: false });
        store.createIndex('admissionDate', 'admissionDate', { unique: false });
      }
    };

    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  async getAllPatients() {
    const store = await tx(STORE_PATIENTS, 'readonly');
    return promisifyRequest(store.getAll());
  },

  async getPatient(id) {
    const store = await tx(STORE_PATIENTS, 'readonly');
    return promisifyRequest(store.get(id));
  },

  async addPatient(patient) {
    const store = await tx(STORE_PATIENTS, 'readwrite');
    const now = new Date().toISOString();
    patient.createdAt = now;
    patient.updatedAt = now;
    if (!Array.isArray(patient.notes)) patient.notes = [];
    return promisifyRequest(store.add(patient));
  },

  async updatePatient(patient) {
    const store = await tx(STORE_PATIENTS, 'readwrite');
    patient.updatedAt = new Date().toISOString();
    return promisifyRequest(store.put(patient));
  },

  async deletePatient(id) {
    const store = await tx(STORE_PATIENTS, 'readwrite');
    return promisifyRequest(store.delete(id));
  },

  async replaceAllPatients(patients) {
    const store = await tx(STORE_PATIENTS, 'readwrite');
    await promisifyRequest(store.clear());
    for (const p of patients) {
      await promisifyRequest(store.put(p));
    }
  },
};

"use client";

const DB_NAME = "revkit-pdf-library";
const STORE_NAME = "documents";
const DB_VERSION = 1;

export interface StoredPdf {
  key: string;
  blob: Blob;
  fileName: string;
  size: number;
  updatedAt: string;
}

function openPdfDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the PDF library."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openPdfDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The PDF library could not be updated."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("The PDF library could not be updated."));
    };
  });
}

export function pdfStorageKey(reviewId: string, studyId: string): string {
  return `revkit-pdf:${reviewId}:${studyId}`;
}

export async function saveStudyPdf(reviewId: string, studyId: string, file: File): Promise<StoredPdf> {
  const record: StoredPdf = {
    key: pdfStorageKey(reviewId, studyId),
    blob: file,
    fileName: file.name,
    size: file.size,
    updatedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(record));
  if (navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => false);
  }
  return record;
}

export async function getStudyPdf(key: string): Promise<StoredPdf | null> {
  const record = await withStore<StoredPdf | undefined>("readonly", (store) => store.get(key));
  return record ?? null;
}

export async function deleteStudyPdf(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}

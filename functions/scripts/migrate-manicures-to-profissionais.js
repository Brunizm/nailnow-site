#!/usr/bin/env node

/**
 * Migra documentos da coleção `manicures` para `profissionais`.
 *
 * Uso:
 *   node scripts/migrate-manicures-to-profissionais.js            # executa migração
 *   node scripts/migrate-manicures-to-profissionais.js --dry-run  # apenas simula
 *
 * Requer credenciais Admin SDK (ex.: GOOGLE_APPLICATION_CREDENTIALS
 * apontando para uma service account com acesso ao Firestore).
 */

const admin = require("firebase-admin");

const DRY_RUN = process.argv.includes("--dry-run");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const SOURCE_COLLECTION = "manicures";
const TARGET_COLLECTION = "profissionais";

function getMergeKey(data = {}, fallbackId = "") {
  const email = String(data.email || data.emailLowercase || "")
    .trim()
    .toLowerCase();
  if (email) return `email:${email}`;

  const cpf = String(data.cpf || data.documento || data.cpfRaw || "").replace(/\D/g, "");
  if (cpf) return `cpf:${cpf}`;

  return `id:${fallbackId}`;
}

async function run() {
  const sourceSnapshot = await db.collection(SOURCE_COLLECTION).get();

  if (sourceSnapshot.empty) {
    console.log("Nenhum documento encontrado em 'manicures'.");
    return;
  }

  const targetSnapshot = await db.collection(TARGET_COLLECTION).get();
  const mergeKeyToTargetId = new Map();

  targetSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    mergeKeyToTargetId.set(getMergeKey(data, doc.id), doc.id);
  });

  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const sourceDoc of sourceSnapshot.docs) {
    const sourceData = sourceDoc.data() || {};
    const mergeKey = getMergeKey(sourceData, sourceDoc.id);
    const existingTargetId = mergeKeyToTargetId.get(mergeKey);

    const payload = {
      ...sourceData,
      role: "profissional",
      migratedFrom: SOURCE_COLLECTION,
      migratedAt: new Date().toISOString(),
    };

    if (!existingTargetId) {
      if (DRY_RUN) {
        created += 1;
      } else {
        const createdRef = await db.collection(TARGET_COLLECTION).add(payload);
        mergeKeyToTargetId.set(mergeKey, createdRef.id);
        created += 1;
      }
      continue;
    }

    if (DRY_RUN) {
      merged += 1;
    } else {
      await db.collection(TARGET_COLLECTION).doc(existingTargetId).set(payload, { merge: true });
      merged += 1;
    }
  }

  console.log(
    `[${DRY_RUN ? "DRY-RUN" : "EXEC"}] Migração concluída: ${created} criados, ${merged} mesclados, ${skipped} ignorados.`
  );
}

run().catch((error) => {
  console.error("Falha na migração:", error);
  process.exitCode = 1;
});

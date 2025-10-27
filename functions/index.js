const functions = require('firebase-functions');

const allowed = [
  'https://www.nailnow.app'
  // se necessário no futuro, adicionar outros domínios aqui
];

exports.verifySignupConfirmation = functions
  .region('southamerica-east1')
  .https.onRequest((req, res) => {
    const origin = req.headers.origin;

    // CORS estrito por lista de origens
    if (allowed.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // res.set('Access-Control-Allow-Credentials', 'true'); // habilitar se precisar de cookies

    // Preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // -------- Lógica da verificação (placeholder) --------
    // Substituir pelo fluxo real quando aplicável
    res.status(200).send('Confirmation verified!');
  });

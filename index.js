const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

// Vérification webhook Shopify
function verifyWebhook(req) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(body)
    .digest('base64');
  return hmac === hash;
}

// Appel Claude
async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

// WEBHOOK 1 : Nouveau produit → génère description SEO
app.post('/webhook/product-created', async (req, res) => {
  res.sendStatus(200);
  const product = req.body;
  const prompt = `Tu es expert SEO e-commerce français pour une boutique de luminaires haut de gamme (Lumora).
  
Produit : ${product.title}
Tags : ${product.tags}

Génère en français :
1. Un titre SEO (max 70 caractères, factuel, sans garanties ni certifications)
2. Une meta description (max 160 caractères)
3. Une description produit (150 mots, ton élégant, specs factuelles uniquement)

Format de réponse :
TITRE: ...
META: ...
DESCRIPTION: ...`;

  const result = await askClaude(prompt);
  console.log(`\n📦 Nouveau produit: ${product.title}`);
  console.log(result);
});

// WEBHOOK 2 : Nouvelle commande → résumé formaté
app.post('/webhook/order-created', async (req, res) => {
  res.sendStatus(200);
  const order = req.body;
  const prompt = `Résume cette commande Shopify en français en 5 lignes claires pour le gérant :
  
Numéro : ${order.name}
Client : ${order.email}
Total : ${order.total_price} ${order.currency}
Articles : ${order.line_items?.map(i => i.title).join(', ')}
Adresse : ${order.shipping_address?.city}, ${order.shipping_address?.country}`;

  const result = await askClaude(prompt);
  console.log(`\n🛒 Nouvelle commande: ${order.name}`);
  console.log(result);
});

// WEBHOOK 3 : Nouvel avis → réponse automatique
app.post('/webhook/review-created', async (req, res) => {
  res.sendStatus(200);
  const review = req.body;
  const prompt = `Tu es le service client de Lumora, boutique de luminaires premium française.
  
Avis client (${review.rating}/5 étoiles) : "${review.body}"

Rédige une réponse professionnelle, chaleureuse et courte (max 3 phrases) en français.`;

  const result = await askClaude(prompt);
  console.log(`\n⭐ Nouvel avis reçu`);
  console.log(result);
});

// Route test
app.get('/', (req, res) => {
  res.json({ status: '✅ Serveur Shopify-Claude actif', version: '1.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

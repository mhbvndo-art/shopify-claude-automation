const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP = 'lumora-7369.myshopify.com';

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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

async function generateDescription(title) {
  const prompt = `Tu es rédacteur e-commerce pour Lumora, boutique française de luminaires design.

Produit : "${title}"

Règles STRICTES Google Merchant Center :
- INTERDIT : "parfait", "idéal", "garanti", "meilleur", "exceptionnel", "unique", "inégalé", "luxe", "premium"
- INTERDIT : certifications CE, UL, RoHS, CCC sauf si dans le titre original
- INTERDIT : délais de livraison, prix, promotions
- AUTORISÉ UNIQUEMENT : matériaux, dimensions, culot (E27/E14/GU10), tension (V), nombre de bras, couleur, type installation
- Phrases courtes et factuelles uniquement

Génère UNIQUEMENT ce HTML sans rien avant ni après :

<style>
.acc-wrap { max-width: 720px; margin: 0 auto; }
.acc-wrap input { display: none; }
.acc-wrap label { display: flex; justify-content: space-between; align-items: center; background: #FAFAF8; color: #2a2a2a; padding: 14px 20px; cursor: pointer; font-size: 13px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; border: 1px solid #E0D8CE; border-radius: 4px; margin-bottom: 8px; transition: all 0.25s ease; }
.acc-wrap label:hover { background: #F4F0EA; border-color: #C8B89A; }
.acc-wrap .content { max-height: 0; overflow: hidden; transition: max-height 0.45s ease, padding 0.3s ease; padding: 0 20px; background: #FFFFFF; border-left: 1px solid #E0D8CE; border-right: 1px solid #E0D8CE; border-bottom: 1px solid #E0D8CE; border-radius: 0 0 4px 4px; margin-top: -8px; margin-bottom: 8px; }
.acc-wrap input:checked + label + .content { max-height: 1000px; padding: 20px; }
.acc-wrap label .icon { font-size: 20px; color: #C8B89A; font-weight: 300; line-height: 1; }
.acc-wrap input:checked + label .icon::after { content: '−'; }
.acc-wrap label .icon::after { content: '+'; }
.spec-list { list-style: none; padding: 0; margin: 0; }
.spec-list li { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid #F2EDE6; font-size: 13.5px; }
.spec-list li:last-child { border-bottom: none; }
.spec-list .spec-label { color: #AAA098; }
.spec-list .spec-value { font-weight: 600; color: #2a2a2a; text-align: right; }
.color-list { list-style: none; padding: 0; margin: 0; }
.color-list li { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #F2EDE6; font-size: 13.5px; color: #2a2a2a; }
.color-list li:last-child { border-bottom: none; }
.color-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; border: 1px solid #D4C5B0; }
.color-list .color-desc { color: #BBB3A8; margin-left: auto; font-style: italic; font-size: 12.5px; }
</style>
<p><strong>[TITRE FACTUEL COURT EN MAJUSCULES]</strong> — [1-2 phrases : matériau, forme, culot, tension. Zéro promesse.]</p>
<div class="acc-wrap">
<input type="checkbox" id="specs-[SLUG]"> <label for="specs-[SLUG]">Spécifications techniques <span class="icon"></span></label>
<div class="content"><ul class="spec-list">
[4-6 specs réelles du produit format : <li><span class="spec-label">Label</span><span class="spec-value">Valeur</span></li>]
</ul></div>
<input type="checkbox" id="coloris-[SLUG]"> <label for="coloris-[SLUG]">Guide des coloris <span class="icon"></span></label>
<div class="content"><ul class="color-list">
<li><span class="color-dot" style="background-color: #fffbea;"></span><strong>Lumière froide 6000K</strong><span class="color-desc">Vive et nette</span></li>
<li><span class="color-dot" style="background-color: #fff8e1;"></span><strong>Lumière neutre 4500K</strong><span class="color-desc">Teinte équilibrée</span></li>
<li><span class="color-dot" style="background-color: #fff0cc;"></span><strong>Lumière chaude 3000K</strong><span class="color-desc">Atmosphère douce</span></li>
</ul></div>
<input type="checkbox" id="contenu-[SLUG]"> <label for="contenu-[SLUG]">Contenu du paquet <span class="icon"></span></label>
<div class="content"><ul class="spec-list">
<li><span class="spec-label">Luminaire</span><span class="spec-value">1 unité</span></li>
<li><span class="spec-label">Notice de montage</span><span class="spec-value">Incluse</span></li>
</ul></div>
</div>`;

  return await askClaude(prompt);
}

async function updateShopifyProduct(productId, description) {
  const res = await fetch(`https://${SHOP}/admin/api/2024-01/products/${productId}.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({
      product: { id: productId, body_html: description }
    })
  });
  const data = await res.json();
  if (data.errors) console.log('❌ Shopify erreur:', JSON.stringify(data.errors));
  return data;
}

async function getAllProducts() {
  try {
    const res = await fetch(`https://${SHOP}/admin/api/2024-01/products.json?limit=250`, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
    });
    const data = await res.json();
    console.log('📋 Réponse Shopify:', JSON.stringify(data).substring(0, 200));
    if (!data.products) {
      console.log('❌ Pas de produits dans la réponse. Token invalide ?');
      return [];
    }
    return data.products;
  } catch (e) {
    console.log('❌ Erreur getAllProducts:', e.message);
    return [];
  }
}

app.post('/webhook/product-created', async (req, res) => {
  res.sendStatus(200);
  const product = req.body;
  console.log(`📦 Nouveau produit: ${product.title}`);
  const description = await generateDescription(product.title);
  await updateShopifyProduct(product.id, description);
  console.log(`✅ Mis à jour: ${product.title}`);
});

app.get('/fix-all-products', async (req, res) => {
  res.json({ message: '🔄 Correction en cours... Vérifie les logs Railway.' });
  const products = await getAllProducts();
  if (!products || products.length === 0) {
    console.log('❌ Aucun produit récupéré — vérifie le SHOPIFY_ACCESS_TOKEN');
    return;
  }
  console.log(`🚀 Début correction de ${products.length} produits...`);
  for (const product of products) {
    try {
      console.log(`⏳ Traitement: ${product.title}`);
      const description = await generateDescription(product.title);
      await updateShopifyProduct(product.id, description);
      console.log(`✅ OK: ${product.title}`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`❌ Erreur: ${product.title} - ${e.message}`);
    }
  }
  console.log('🎉 Terminé !');
});

app.post('/webhook/order-created', async (req, res) => {
  res.sendStatus(200);
  const order = req.body;
  const prompt = `Résume cette commande en 5 lignes pour le gérant de Lumora :
Numéro : ${order.name} | Client : ${order.email} | Total : ${order.total_price} ${order.currency} | Articles : ${order.line_items?.map(i => i.title).join(', ')}`;
  const result = await askClaude(prompt);
  console.log(`🛒 Commande ${order.name}:\n${result}`);
});

app.get('/', (req, res) => {
  res.json({ status: '✅ Serveur Shopify-Claude actif', version: '4.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));

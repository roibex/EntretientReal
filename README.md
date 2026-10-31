# Entretien paysager Real — Facturation

Application web de facturation : factures, devis, paiements, relevés, dépenses et rapports TPS/TVQ.

- `index.html` — page d'accueil
- `app.html` + `app.js` + `styles.css` — l'application
- `config.js` — connexion à Supabase (à remplir)
- `supabase.sql` — création de la base de données

Tant que `config.js` est vide, l'app fonctionne en **mode local** (données dans le navigateur seulement).
Une fois rempli, elle demande une **connexion** et enregistre tout **en ligne**.

---

## Étape 1 — Créer la base de données (Supabase, gratuit)

1. Va sur <https://supabase.com>, clique **Start your project** et crée ton compte.
2. Clique **New project**. Nom : `facto`. Choisis un mot de passe de base de données (garde-le en lieu sûr) et la région **Canada (Central)**. Clique **Create new project** et attends 1-2 minutes.
3. Dans le menu de gauche, ouvre **SQL Editor** → **New query**. Copie-colle tout le contenu de `supabase.sql`, puis clique **Run**. Tu dois voir « Success ».
4. Ouvre **Project Settings** → **API** (ou **Data API** / **API Keys**). Copie :
   - le **Project URL** (ex. `https://abcdxyz.supabase.co`)
   - la clé **anon public** (ou **publishable**) — **pas** la clé `service_role` / `secret`!
5. Ouvre `config.js` et colle les deux valeurs entre les apostrophes :
   ```js
   window.FACTO_CONFIG = {
     supabaseUrl: 'https://abcdxyz.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...',
   };
   ```

## Étape 2 — Mettre le site en ligne (GitHub Pages, gratuit)

1. Sur <https://github.com>, clique **+** → **New repository**. Nom : `facto`. Laisse-le **Public** (obligatoire pour GitHub Pages gratuit). Clique **Create repository**.
2. Sur la page du dépôt, clique **uploading an existing file** et glisse-y ces fichiers :
   `index.html`, `app.html`, `app.js`, `styles.css`, `config.js`, `supabase.sql`, `README.md`.
   Clique **Commit changes**.
3. Va dans **Settings** → **Pages**. Sous **Branch**, choisis `main` et `/ (root)`, puis **Save**.
4. Après 1-2 minutes, ton site est à `https://TON-NOM-GITHUB.github.io/facto/`.

## Étape 3 — Relier Supabase à l'adresse du site

Pour que les liens de confirmation et de mot de passe oublié reviennent sur ton site :

1. Dans Supabase : **Authentication** → **URL Configuration**.
2. **Site URL** : `https://TON-NOM-GITHUB.github.io/facto/app.html`
3. Sous **Redirect URLs**, ajoute aussi : `https://TON-NOM-GITHUB.github.io/facto/**`

## Étape 4 — Créer ton compte, puis fermer les inscriptions

1. Ouvre `https://TON-NOM-GITHUB.github.io/facto/app.html`, clique **Créer un compte**.
2. Confirme ton courriel avec le lien reçu, puis connecte-toi.
3. Va dans **Paramètres** de l'app et remplis ton adresse, tes numéros de TPS/TVQ, etc.
4. **Important** : pour que personne d'autre ne puisse se créer un compte sur ton site, dans Supabase va dans
   **Authentication** → **Sign In / Providers** (ou **Settings**) et désactive **Allow new users to sign up**.
   (Même si quelqu'un créait un compte, il ne verrait jamais tes données — mais autant fermer la porte.)

---

## Notes

- Le dépôt GitHub est public : le code est visible, mais **pas tes données** (elles sont dans Supabase, protégées par ton mot de passe). La clé `anon` dans `config.js` est faite pour être publique.
- Fais de temps en temps **Paramètres → Exporter (JSON)** pour garder une copie de sauvegarde.
- Le plan gratuit de Supabase met le projet en pause après 7 jours sans aucune utilisation; il suffit de le réactiver dans le tableau de bord Supabase.
- Les données sont sauvegardées automatiquement une demi-seconde après chaque changement (indiqué en bas du menu).

# Käyttöönotto: oma sovellus Cloudflareen

Tällä ohjeella saat työnhaun seurannan omaksi sovellukseksi, joka toimii selaimessa ja puhelimessa. Sinun lisäksesi kukaan muu ei pääse siihen. Kaikki tarvittava kuuluu Cloudflaren ilmaiseen tasoon.

Tarvitset Cloudflare-tilin (dash.cloudflare.com) ja pääsyn tähän GitHub-repoon. Aikaa kuluu noin 20 minuuttia, ja vaiheet tehdään vain kerran.

## 1. Sivusto Cloudflare Pagesiin

1. Avaa Cloudflaren hallintapaneelista **Workers & Pages → Create → Pages → Connect to Git**.
2. Valitse repo `tyonhaku-dashboard` ja haara `main`.
3. Täytä build-asetukset:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Valitse **Save and Deploy**. Ensimmäinen build kestää pari minuuttia.

Sivuston osoite on muotoa `https://<projektin-nimi>.pages.dev`. Älä vielä jaa sitä kenellekään, koska tietokanta ja kirjautuminen puuttuvat.

### Oma osoite (valinnainen)

Jos sinulla on oma domain samalla Cloudflare-tilillä, sovellus voi olla sen alidomainissa, esimerkiksi `tyonhaku.<oma-domain>`. Sellainen osoite on helpompi muistaa ja kirjoittaa puhelimella.

1. Avaa Pages-projektin **Custom domains → Set up a custom domain** ja kirjoita alidomain.
2. Cloudflare lisää DNS-tietueen itse. Osoite toimii yleensä muutamassa minuutissa.

`pages.dev`-osoite jää toimimaan oman osoitteen rinnalle, joten vaiheessa 3 molemmat osoitteet laitetaan kirjautumisen taakse.

Alidomainin nimi näkyy julkisissa varmennelokeissa (certificate transparency). Kuka tahansa voi siis nähdä, että osoite on olemassa, mutta sisältö on kirjautumisen takana. Älä laita nimeen mitään, minkä et halua olevan julkista.

## 2. Tietokanta (D1)

1. Avaa **Workers & Pages → D1 SQL Database → Create** ja anna nimeksi esimerkiksi `tyonhaku`.
2. Avaa Pages-projektin **Settings → Bindings → Add → D1 database**.
   - Variable name: `DB`
   - Database: `tyonhaku`
3. Tallenna asetus.

Tauluja ei tarvitse luoda itse. Sovellus luo ne ensimmäisellä käyttökerralla.

## 3. Kirjautuminen (Cloudflare Access)

1. Avaa **Zero Trust** (vasen valikko). Jos käytät sitä ensimmäistä kertaa, valitse tiimille nimi (team name) ja ilmainen Free-paketti.
2. Avaa **Access → Applications → Add an application → Self-hosted**.
   - Application domain: Pagesin osoite, esimerkiksi `<projektin-nimi>.pages.dev`. Jos teit oman osoitteen, lisää samaan sovellukseen myös se (**Add public hostname**). Molemmat osoitteet käyttävät samaa AUD-tagia.
   - Policy: **Allow**, ehdoksi **Emails** ja oma sähköpostiosoitteesi
   - Kirjautumistavaksi riittää **One-time PIN**, jolloin koodi tulee sähköpostiin. Google-kirjautumisen voi lisätä myöhemmin.
3. Kun sovellus on tallennettu, avaa se ja kopioi **Application Audience (AUD) Tag**.
4. Avaa Pages-projektin **Settings → Variables and Secrets** ja lisää tuotantoympäristöön kolme muuttujaa:

   | Nimi | Arvo |
   |---|---|
   | `ACCESS_TEAM_DOMAIN` | `<tiimin-nimi>.cloudflareaccess.com` |
   | `ACCESS_AUD` | AUD-tagi kohdasta 3 |
   | `ALLOWED_EMAIL` | oma sähköpostiosoitteesi (useamman voi erottaa pilkulla) |

5. Avaa **Deployments** ja valitse uusimmasta **Retry deployment**, jotta asetukset tulevat voimaan.

Sovellus tarkistaa jokaisessa pyynnössä myös itse, että kirjautuminen on voimassa ja sähköposti on sallittu. Jos asetukset puuttuvat, sovellus ei näytä dataa kenellekään.

## 4. Hakemukset mukaan

1. Avaa sovellus selaimessa ja kirjaudu. Saat sähköpostiin koodin.
2. Sovellus aukeaa tyhjänä. Valitse alalaidasta **Tuo varmuuskopio** ja sitten varmuuskopiotiedosto (`.json`).
3. Hakemukset, viikkotavoite ja hahmosi tulevat näkyviin.

Varmuuskopion saa jatkossa samasta paikasta valinnalla **Lataa varmuuskopio (JSON)**.

## 5. Puhelimeen (Android)

1. Avaa sovelluksen osoite puhelimen Chromessa ja kirjaudu. Jos teit oman osoitteen, käytä sitä: asennettu sovellus ja Jaa-valikon kohde kuuluvat siihen osoitteeseen, josta asennat.
2. Valitse valikosta ⋮ → **Asenna sovellus** (tai **Lisää aloitusnäytölle**).
3. Työnhaku-ikoni (pikselihahmo) ilmestyy aloitusnäytölle, ja sovellus aukeaa ilman selaimen palkkeja.

### Ilmoituksen tallennus Jaa-valikosta

Kun näet kiinnostavan ilmoituksen esimerkiksi LinkedInissä, Duunitorissa tai selaimessa:

1. Valitse **Jaa → Työnhaku**.
2. Sovellus aukeaa, ja lisäysikkunassa on valmiina ilmoituksen linkki, otsikko ja tila **Haettava**.
3. Kirjoita työnantaja ja tarvittaessa määräaika, ja tallenna.

Ilmoitus näkyy Tänään-näkymän **Haettavat**-listassa. Lähestyvät määräajat nousevat listan kärkeen ja Tänään-merkin lukuun. Kun olet lähettänyt hakemuksen, valitse **Merkitse haetuksi**, jolloin saat XP:t ja hakemus siirtyy hakulokiin.

## Vianetsintä

| Oire | Syy ja korjaus |
|---|---|
| "Kirjautumista ei ole määritetty" | Vaiheen 3 muuttujat puuttuvat tai deploy on tehty ennen niitä. Tarkista nimet ja tee Retry deployment. |
| "Tietokantaa ei ole liitetty" | D1-binding puuttuu tai sen nimi ei ole täsmälleen `DB` (vaihe 2). |
| "Tällä tunnuksella ei ole pääsyä" | Kirjauduit eri sähköpostilla kuin `ALLOWED_EMAIL`. |
| "Kirjautuminen on vanhentunut" | Access-istunto on päättynyt. Paina **Kirjaudu uudelleen**. |
| Toinen osoite näyttää tyhjää tai kysyy kirjautumista uudelleen | Osoite puuttuu Access-sovelluksesta. Lisää se vaiheen 3 kohdassa Add public hostname. Kirjautuminen on osoitekohtainen, joten kummassakin osoitteessa kirjaudutaan erikseen. |
| Työnhaku ei näy Jaa-valikossa | Sovellus pitää asentaa Chromen kautta (vaihe 5). Pelkkä kirjanmerkki ei riitä. |

# Käyttöönotto: oma sovellus Cloudflareen

Tällä ohjeella saat työnhaun seurannan omaksi sovellukseksi, joka toimii selaimessa ja puhelimessa. Sinun lisäksesi kukaan muu ei pääse siihen. Kaikki tarvittava kuuluu Cloudflaren ilmaiseen tasoon. Kirjautumisen (Zero Trust) käyttöönotossa Cloudflare pyytää maksutavan, mutta ilmaisesta paketista ei veloiteta mitään.

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

1. Avaa **Cloudflare One** (vasen valikko; vanha nimi Zero Trust). Jos käytät sitä ensimmäistä kertaa, valitse tiimille nimi (team name) ja ilmainen Free-paketti. Cloudflare pyytää maksutavan (kortti tai PayPal), mutta Free-paketista ei veloiteta. Maksu tulisi vasta, jos vaihdat itse maksulliseen pakettiin.
2. Avaa **Access → Applications → Add an application → Self-hosted**.
   - **Destinations → Public hostnames:** lisää Pagesin osoite (Domain `<projektin-nimi>.pages.dev`, Subdomain tyhjä). Jos teit oman osoitteen, lisää samaan sovellukseen myös se (**Add public hostname**). Molemmat osoitteet käyttävät samaa AUD-tagia. Halutessasi lisää vielä rivi, jossa Subdomain on `*` ja Domain `<projektin-nimi>.pages.dev`. Silloin myös esikatseluosoitteet ovat kirjautumisen takana.
   - **Policy:** luo uusi. Anna nimi (esim. "Vain minä"), Action **Allow**, ehdoksi Include → **Emails** ja oma sähköpostiosoitteesi. Valitse **Policy session duration** -kohtaan pisin vaihtoehto (esim. 1 month), niin puhelimella ei tarvitse kirjautua joka päivä.
   - **Authentication:** jätä **Accept all available identity providers** päälle. Jos laitat päälle **Apply instant authentication**, kirjautumistavan valinta jää väliin, kun tapoja on vain yksi.
3. Lisää sähköpostikoodi kirjautumistavaksi: **Settings → Authentication → Login methods → Add new → One-time PIN**. Uudella tilillä valmiina on usein vain tapa "Cloudflare", jolla kirjaudutaan Cloudflare-tilin tunnuksilla. Sekin toimii, mutta puhelimella sähköpostikoodi on helpompi. Google-kirjautumisen voi lisätä myöhemmin samasta paikasta.
4. Kun sovellus on tallennettu, avaa se ja valitse **Additional settings → AUD tag**. Kopioi kohdan **Token** arvo (pitkä merkkijono). Älä paina **Revoke existing tokens**.
5. Avaa Pages-projektin **Settings → Variables and Secrets** ja lisää tuotantoympäristöön kolme muuttujaa:

   | Nimi | Arvo |
   |---|---|
   | `ACCESS_TEAM_DOMAIN` | `<tiimin-nimi>.cloudflareaccess.com` (tiimin nimi: Cloudflare One → **Settings → Team name**) |
   | `ACCESS_AUD` | AUD-tagi kohdasta 4 |
   | `ALLOWED_EMAIL` | oma sähköpostiosoitteesi (useamman voi erottaa pilkulla) |

   Muuttujien tyypiksi käy **Text**. Tarkista, ettei AUD-tagin perään jäänyt välilyöntiä tai rivinvaihtoa.
6. Avaa **Deployments** ja valitse uusimmasta **Retry deployment**, jotta asetukset tulevat voimaan.

Jos vaihdat tiimin nimen myöhemmin, päivitä `ACCESS_TEAM_DOMAIN`, tee Retry deployment ja kirjaudu uudelleen.

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
| Kirjautuminen onnistuu, mutta sovellus pyytää heti kirjautumaan uudelleen | `ACCESS_TEAM_DOMAIN` tai `ACCESS_AUD` on väärin, tai tiimin nimeä on vaihdettu kirjautumisen jälkeen. Tarkista arvot, tee Retry deployment, avaa `<osoite>/cdn-cgi/access/logout` ja kirjaudu uudelleen. |
| Toinen osoite näyttää tyhjää tai kysyy kirjautumista uudelleen | Osoite puuttuu Access-sovelluksesta. Lisää se vaiheen 3 kohdassa Add public hostname. Kirjautuminen on osoitekohtainen, joten kummassakin osoitteessa kirjaudutaan erikseen. |
| Työnhaku ei näy Jaa-valikossa | Sovellus pitää asentaa Chromen kautta (vaihe 5). Pelkkä kirjanmerkki ei riitä. |

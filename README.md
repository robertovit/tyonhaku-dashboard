# Työnhaku-dashboard

Oma työnhaun seurantatyökalu, jossa hakemukset, odottavat haut ja viikkotavoite näkyvät yhdessä näkymässä. Ulkoasu on tumma JRPG-valikko: hakijalla on pikselihahmo, taso ja esineinä kerättävät saavutukset.

**[Kokeile demoa →](https://robertovit.github.io/tyonhaku-dashboard/)** Demossa on keksittyä esimerkkidataa. Voit lisätä ja muokata hakemuksia vapaasti, ja muutokset tallentuvat vain omaan selaimeesi.

![Työnhaku-dashboard](docs/dashboard.png)

Kuvakaappauksen ja demon hakemukset ovat keksittyä esimerkkidataa. Omat hakemukseni eivät ole tässä repossa.

## Mitä se tekee

- **Tänään-näkymä:** hahmo, jonka varusteet kasvavat tason mukana, sekä XP-, viikkotavoite- ja putkimittarit. Tehtävät-listassa ovat hakemukset, joista ei ole kuulunut yli kolmeen viikkoon. Niille on pikatoiminnot: kuittaa ei valituksi, muistuta myöhemmin tai muokkaa.
- **Esineet:** 14 saavutusta. Valitusta näkee, miten sen saa ja miltä viikolta se on ansaittu.
- **Tilastot:** lopputulokset, suppilo hausta tarjoukseen, tehtävätyypit, työnantajat ja hakijamäärät.
- **Hakuloki:** kaikki hakemukset tilan mukaan suodatettavina, ja jokaisen hakemuksen XP.
- **Haettavat:** kiinnostavan ilmoituksen voi ottaa talteen ennen kuin hakee. Lista järjestyy määräajan mukaan, ja **Merkitse haetuksi** tuo XP:t.
- **Lisää hakemus:** PALKKIO-paneeli näyttää, paljonko XP:tä tallennus tuo ja miten viikkotavoite etenee.
- **Puhelimessa:** sovelluksen voi asentaa aloitusnäytölle (PWA). Androidissa se näkyy Jaa-valikossa, joten ilmoituksen saa talteen suoraan LinkedInistä tai selaimesta.
- **Pelisäännöt** palkitsevat tekemistä, eivät lopputulosta, joten myös käsitelty hylkäys tuottaa XP:tä.
- Tumma ja vaalea teema, mobiilissa alapalkkivalikko, ja **CSV-lataus** varmuuskopioksi.

## Tekniikka

React 19, TypeScript, Vite ja visx (D3:n asteikot ja muodot kaavioihin). Testit Vitestillä, lint ESLintillä ja muotoilu Prettierillä.

Sovellus pyörii Cloudflare Pagesissa:

- Palvelinpuoli on Pages Functions -rajapinta, ja data on D1-tietokannassa.
- Cloudflare Access päästää sisään vain omistajan.
- Sovelluksen saa asennettua puhelimeen `vite-plugin-pwa`:n avulla.

Rakenteesta:

- `src/lib/` sisältää puhtaan logiikan ilman Reactia: datamalli, päivämäärät, tilastot, pelisäännöt ja CSV. Päivä annetaan funktioille parametrina, joten testit ovat deterministisiä.
- `src/lib/store.ts` määrittelee rajapinnat, joita käyttöliittymä käyttää. Toteutus on `web.ts`, joka puhuu omalle palvelimelle. `npm run dev` käyttää sen sijaan muistissa toimivaa esimerkkidataa (`src/dev/memory.ts`).
- `functions/` on palvelimen rajapinta. Se tarkistaa kirjautumisen ja validoi jokaisen hakemuksen samalla datamallilla kuin käyttöliittymä.
- `src/components/` on käyttöliittymä ja `src/components/charts/` kaaviot.

## Kehitys

```bash
npm install
npm run dev      # paikallinen versio esimerkkidatalla
npm run check    # tyyppitarkistus, lint ja testit
npm run build    # web-sovellus kansioon dist/
npm run build:demo # julkinen demo kansioon dist-demo/ (GitHub Pages)
npm run serve:web  # koko pino paikallisesti (wrangler + paikallinen D1)
```

`npm run dev` käyttää keksittyä esimerkkidataa. Oman asennuksen ohjeet ovat tiedostossa [docs/KAYTTOONOTTO.md](docs/KAYTTOONOTTO.md).

Tehty Claude Coden kanssa.

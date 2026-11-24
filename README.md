# Työnhaku-dashboard

Oma työnhaun seurantatyökalu, jossa hakemukset, odottavat haut ja viikkotavoite näkyvät yhdessä näkymässä. Ulkoasu on tumma JRPG-valikko: hakijalla on pikselihahmo, taso ja esineinä kerättävät saavutukset.

![Työnhaku-dashboard](docs/dashboard.png)

Kuvakaappauksen hakemukset ovat keksittyä esimerkkidataa. Omat hakemukseni eivät ole tässä repossa.

## Mitä se tekee

- **Tänään-näkymä:** hahmo, jonka varusteet kasvavat tason mukana, sekä XP-, viikkotavoite- ja putkimittarit. Tehtävät-listassa ovat hakemukset, joista ei ole kuulunut yli kolmeen viikkoon. Niille on pikatoiminnot: kuittaa ei valituksi, muistuta myöhemmin tai muokkaa.
- **Esineet:** 14 saavutusta. Valitusta näkee, miten sen saa ja miltä viikolta se on ansaittu.
- **Tilastot:** lopputulokset, suppilo hausta tarjoukseen, tehtävätyypit, työnantajat ja hakijamäärät.
- **Hakuloki:** kaikki hakemukset tilan mukaan suodatettavina, ja jokaisen hakemuksen XP.
- **Lisää hakemus:** Claude voi täyttää kentät liitetystä työpaikkailmoituksesta. PALKKIO-paneeli näyttää, paljonko XP:tä tallennus tuo ja miten viikkotavoite etenee.
- **Pelisäännöt** palkitsevat tekemistä, eivät lopputulosta, joten myös käsitelty hylkäys tuottaa XP:tä.
- Tumma ja vaalea teema, mobiilissa alapalkkivalikko, ja **CSV-lataus** varmuuskopioksi.

## Tekniikka

React 19, TypeScript, Vite ja visx (D3:n asteikot ja muodot kaavioihin). Testit Vitestillä, lint ESLintillä ja muotoilu Prettierillä. Koko sovellus rakentuu yhdeksi HTML-tiedostoksi `vite-plugin-singlefile`-lisäosalla.

Rakenteesta:

- `src/lib/` sisältää puhtaan logiikan ilman Reactia: datamalli, päivämäärät, tilastot, pelisäännöt ja CSV. Päivä annetaan funktioille parametrina, joten testit ovat deterministisiä.
- `src/lib/store.ts` määrittelee rajapinnat, joita käyttöliittymä käyttää. Tallennus on yhden tiedoston takana, joten taustajärjestelmän voi vaihtaa vaihtamalla vain sen.
- `src/components/` on käyttöliittymä ja `src/components/charts/` kaaviot.

## Kehitys

```bash
npm install
npm run dev      # paikallinen versio esimerkkidatalla
npm run check    # tyyppitarkistus, lint ja testit
npm run build    # rakentaa yhden HTML-tiedoston
```

`npm run dev` käyttää keksittyä esimerkkidataa. Itse käytän sovellusta yksityisenä claude.ai-artifactina, jossa omat hakemukseni tallentuvat sen omaan tietokantaan.

Tehty Claude Coden kanssa.

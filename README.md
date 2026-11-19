# Työnhaku-dashboard

Oma työnhaun seurantatyökalu, jossa hakemukset, odottavat haut ja viikkotavoite näkyvät yhdessä näkymässä. Mukana on kevyt pelillistäminen: taso, avatar, viikkoputki ja saavutukset.

![Työnhaku-dashboard](docs/dashboard.png)

Kuvakaappauksen hakemukset ovat keksittyä esimerkkidataa. Omat hakemukseni eivät ole tässä repossa.

## Mitä se tekee

- **Tänään-näkymä** nostaa esiin hakemukset, joista ei ole kuulunut yli kolmeen viikkoon, ja antaa niille pikatoiminnot (merkitse ei valituksi, muistuta myöhemmin, muokkaa).
- **Viikkotavoite** ja viikoittainen kaavio näyttävät, kuinka monta hakemusta on lähtenyt ja kuinka paljon tavoitteesta puuttuu.
- **Tilastot** vastaushetkistä, lopputuloksista ja hakijamääristä visx-kaavioina.
- **Pelillistäminen:** XP, tasot, viikkoputki ja 14 saavutusta. Pisteet palkitsevat tekemistä, eivät lopputulosta, joten myös käsitelty hylkäys tuottaa XP:tä.
- **CSV-lataus** varmuuskopioksi.

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

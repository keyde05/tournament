# vulsanX Badminton Tournament

Web app turnamen badminton untuk vulsanX. HTML/CSS/JS biasa (vanilla) sahaja —
tiada backend, tiada build step. Semua data tersimpan dalam `localStorage`
peranti yang digunakan untuk menjalankan turnamen.

## Cara guna

1. **Superadmin** buka [admin.html](admin.html) di peranti yang akan digunakan
   untuk jalankan turnamen (laptop/tablet meja skor):
   - Kali pertama: set password admin (disimpan dalam browser peranti itu sahaja,
     tidak pernah masuk ke dalam fail yang di-push ke GitHub).
   - Cipta turnamen baru (nama + bilangan player setiap team).
   - Tambah team beserta nama player.
   - Klik **Generate Bracket** bila semua team sudah didaftarkan (minimum 2 team).
   - Semasa pertandingan, admin boleh terus klik nama team yang menang pada
     setiap match dalam bracket, atau biarkan team itu sendiri report
     keputusan (lihat bawah).

2. **Player/Team** boleh buka [index.html](index.html) pada peranti mereka
   sendiri (telefon contohnya):
   - Pilih nama team mereka sekali sahaja (terkunci pada peranti tersebut).
   - Bila team mereka ada match yang sedang "ready", butang **Kami Menang /
     Kami Kalah** akan muncul — tekan untuk terus update bracket, tanpa perlu
     admin edit manual.

> **Nota penting:** Oleh kerana app ini statik (tiada server/database),
> setiap peranti ada storan sendiri yang berasingan. Untuk hasil yang
> konsisten semasa acara berlangsung, jalankan klik Win/Lose pada **satu
> peranti utama** (peranti admin/meja skor) yang dikongsi semasa pertandingan,
> dan guna langkah **Export** di bawah untuk kongsi keputusan terkini kepada
> semua orang selepas acara / selepas setiap pusingan.

## Publish ke GitHub Pages

1. Selepas keputusan terkini disimpan di peranti admin, buka **admin.html**
   → klik **Export data.json**. Ini akan turunkan fail `data.json` terkini.
2. Ganti fail `data.json` dalam folder projek ini dengan fail yang baru
   dimuat turun.
3. Commit & push ke GitHub:
   ```bash
   git add data.json
   git commit -m "Update tournament results"
   git push
   ```
4. Aktifkan GitHub Pages (Settings → Pages → pilih branch `main`, folder root).
   Link contoh: `https://<username>.github.io/<repo>/`
5. Sesiapa yang buka link tersebut akan nampak bracket & leaderboard terkini
   (snapshot dari `data.json`) — paparan ini *read-only* (boleh claim team
   & cuba tekan win/lose untuk preview sendiri, tetapi ia hanya tersimpan
   dalam browser mereka, tidak akan terpapar kepada orang lain).

## Struktur fail

```
index.html      Paparan public (bracket, leaderboard, claim team, win/lose)
admin.html      Panel superadmin (login, urus turnamen/team, generate bracket)
css/style.css   Styling
js/data.js      Data layer (localStorage, bracket generation, match logic)
js/app.js       Logik paparan public
js/admin.js     Logik panel admin
data.json       Snapshot data yang dipublish (di-load sebagai default bila
                localStorage peranti masih kosong)
```

## Jalankan secara lokal (Laragon)

Buka terus `http://localhost/tournament/index.html` atau
`http://localhost/tournament/admin.html` (Laragon serve fail statik terus,
tiada konfigurasi tambahan diperlukan).

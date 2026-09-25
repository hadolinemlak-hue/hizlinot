# Hızlı Not · Müşteri & Portföy Defteri

Telefonda tek elle, saniyeler içinde müşteri ve portföy notu almak için tek klasörde çalışan Türkçe web uygulaması. Sunucu yok, üyelik yok, internet gerekmez — veriler yalnızca telefonda tutulur.

## Neler var

**Müşteri sekmesi**
- Ad soyad, cep numarası, "ne aradı" notu
- Bütçe ve aradığı bölge
- Tek dokunuşla etiketler: Yeni ev arıyor · Kiralık arıyor · Satmak istiyor · Yerinde görmek · Fiyat sordu · Tekrar arayacağım · Yatırımcı
- Kayıt kartındaki numaraya dokununca **telefon hemen aranır**
- Arama: isim, konu veya numaranın herhangi bir parçası (Türkçe karakter duyarsız: "sukran" yazınca "Şükran" bulunur)

**Portföy sekmesi**
- Başlık, **tür** (Daire · Dükkan · Ofis · Fabrika · Arsa · Hisse), durum (Satılık / Kiralamaya / Satıldı), fiyat
- Oda sayısı, m², kat, bina yaşı, iskan durumu, serbest özellik metni
- Konum: il · ilçe · mahalle · sokak-kapı → tek dokunuşla **Apple Haritalar** açılır
- Portföy sahibi / malik ve **sahibinin cep numarası** (ayrı "Sahibi Ara" düğmesi)
- "Kimden geldi?" alanı (sahibi, müşteri referansı, portföy ofisi, sosyal medya…)
- Arama: başlık, tür, özellik, konum, sahibi veya fiyat üzerinden

**Hız için tasarım**
- Kaydet düğmesi ekranın altına yapışık; klavye açıkken de görünür
- Kaydettikten sonra form otomatik temizlenir, ilk alan seçili kalır → art arda kayıt yapılabilir
- Yazarken taslak otomatik saklanır, uygulama kapanırsa bile not kaybolmaz
- Silinen kayıt "Geri Al" ile geri getirilebilir
- Ekran açık kalır (wake lock) — görüşme sırasında ekran sönmez
- Yazdırma / PDF: müşteri, portföy veya ikisi birden

**Veri güvenliği**
- JSON yedek alma (iPhone'da paylaşma menüsüyle "Dosyalara Kaydet" / iCloud / e-posta)
- Yedekten geri yükleme: **Birleştir** (mükerrer kayıt eklemez) veya **Değiştir**
- Excel/CSV dışa aktarma
- Veriler sunucuya gönderilmez

## Dosyalar

- `index.html` — arayüz
- `styles.css` — mobil tema + yazdırma görünümü
- `app.js` — kayıt, arama, yedekleme, dışa/içe aktarma
- `manifest.webmanifest`, `sw.js` — ana ekrana ekleme ve çevrimdışı çalışma
- `icon-180.png`, `icon-192.png`, `icon-512.png` — uygulama ikonları

## iPhone'da kullanım (önerilen)

### 1. GitHub Pages ile yayınlama (en iyi yöntem)

1. Bu klasörü GitHub'da yeni bir repository olarak yükleyin.
2. **Settings → Pages** → **Deploy from a branch** → Branch: `main`, Folder: `root (/)`.
3. Birkaç dakika sonra `https://<kullanici>.github.io/<repo>/` adresi yayınlanır.

### 2. iPhone'da ana ekrana ekleme

1. iPhone'da Safari ile yukarıdaki adresi açın.
2. Alt ortadaki **Paylaş** düğmesine dokunun → **Ana Ekrana Ekle**.
3. Uygulama tam ekran açılır, internet olmasa da çalışır (dosyalar cihazda önbelleğe alınır).

### 3. Bilgisayarda denemek

```bash
cd musteri-portfoy-notlari
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın. Klasörü çift tıklayıp `index.html` dosyasını doğrudan da açabilirsiniz; uygulama çalışır, ancak bu durumda ana ekrana ekleme ve çevrimdışı önbellek özellikleri devreye girmez.

## Önemli

- Veriler yalnızca kullandığınız tarayıcının `localStorage` alanında saklanır. Telefonu silmek, tarayıcı verilerini temizlemek veya farklı bir tarayıcı kullanmak notları **kaybettirir**. Haftada bir **Yedek Al** deyip dosyayı iCloud Drive'a gönderin.
- Aynı notu iki telefonda tutmak istiyorsanız yedek dosyasını iCloud'a atın; yeni telefonda **Geri Yükle → Birleştir** ile aktarın.
- Uygulama kişisel ve ticari not defteridir; resmî kayıt veya belge niteliği taşımaz.

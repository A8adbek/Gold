# FileG Android APK

FileG — Android uchun video format tekshiruvchi va yuklagich. YouTube havolasini kiritgandan so‘ng videoda mavjud sifatlarni (4K, Full HD, HD va kichikroq formatlar) ko‘rsatadi; foydalanuvchi video yoki MP3 ni tanlaydi. Yuklash jarayoni ilova ichidagi terminal panelida chiqadi, fayl `Downloads/FileG` ichiga saqlanadi.

## APK build

GitHub Actions `fileG` loyihasidan arm64 debug APK yig‘adi. Repozitoriyadagi **Actions → Build FileG APK → Artifacts → FileG-APK** dan yuklab oling. Telefoningizda APK faylini ochib o‘rnating. APK AArch64/arm64 qurilmalar uchun tuzilgan.

Mahalliy build uchun Java 17, Android SDK (API 35) va Gradle 8.10.2 kerak:

```sh
gradle -p fileG --no-daemon assembleDebug
```

APK: `fileG/app/build/outputs/apk/debug/app-debug.apk`.

## Muhim

- Video formatlari havoladagi manbaga qarab farq qiladi. 4K yoki Full HD har videoda bo‘lmaydi.
- MP3 uchun ichiga qo‘shilgan FFmpeg ishlatiladi.
- Faqat o‘zingizga tegishli yoki yuklab olishga ruxsatingiz bor videolardan foydalaning; platforma qoidalari va mualliflik huquqiga rioya qiling.
- Android ilovasi `youtubedl-android` va uning FFmpeg modulidan foydalanadi. Litsenziyasi va manba eslatmalari [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) ichida.

Oldingi Termux orqali ishlaydigan prototip uchun `fileg.py` va ildizdagi `index.html` saqlab qolingan.

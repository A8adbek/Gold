# FileG (Termux)

FileG — Android telefonda Termux orqali ishlaydigan YouTube havola tekshiruvchi va format tanlagich. U manbada mavjud video sifatlarini (4K, Full HD, HD yoki kichik format) va MP3 ni ko‘rsatadi, tanlanganni `Downloads/FileG` ichiga saqlaydi. Yuklash jarayoni ilova oynasidagi terminalda ko‘rinadi.

Hozirgi versiya APK emas: Termux va Python orqali ishga tushadi. Faqat o‘zingizga tegishli yoki yuklab olishga ruxsatingiz bor videolar uchun foydalaning; platforma qoidalari va mualliflik huquqiga rioya qiling.

## Android’da ishga tushirish

1. Termux’ni ishonchli rasmiy manbadan o‘rnating va oching.
2. Termux’da quyidagi buyruqlarni kiriting:

```sh
pkg update -y
pkg install python ffmpeg git -y
termux-setup-storage
python -m pip install -U yt-dlp
git clone https://github.com/A8adbek/Gold.git
cd Gold/fileG
python fileg.py
```

3. Termux oynasi ochiq turgan holda telefondagi Chrome’da `http://127.0.0.1:8765` manzilini oching.
4. YouTube havolasini tekshiring, mavjud formatdan birini tanlang va yuklab oling. Fayl `Internal storage/Download/FileG` ichida bo‘ladi.

## Eslatma

- 4K va Full HD faqat manbada shu sifat bo‘lsa chiqadi. Sifat va formatlar har bir videoda farq qiladi.
- MP3 uchun `ffmpeg` zarur.
- Server faqat telefonning o‘zidagi `127.0.0.1` manzilida ishlaydi; tarmoqdagi boshqa qurilmalar kira olmaydi.
- YouTube o‘zgarishidan keyin xatolik chiqsa, `python -m pip install -U yt-dlp` bilan yangilang.

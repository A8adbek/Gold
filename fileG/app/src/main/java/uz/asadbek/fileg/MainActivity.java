package uz.asadbek.fileg;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.mapper.VideoFormat;
import com.yausername.youtubedl_android.mapper.VideoInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import kotlin.Unit;

public class MainActivity extends Activity {
    private WebView web;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Set<String> checkedChoices = Collections.newSetFromMap(new java.util.concurrent.ConcurrentHashMap<>());
    private volatile String checkedUrl = "";
    private volatile boolean busy = false;
    private volatile boolean engineReady = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(16, 19, 26));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(16, 19, 26));
        web = new WebView(this);
        web.setBackgroundColor(android.graphics.Color.rgb(16, 19, 26));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "FileG");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        worker.execute(() -> {
            try {
                YoutubeDL.getInstance().init(getApplicationContext());
                FFmpeg.getInstance().init(getApplicationContext());
                engineReady = true;
                js("window.onLog('FileG tayyor. YouTube havolasini kiriting.');");
            } catch (Exception e) {
                js("window.onError(" + JSONObject.quote("Yuklash moduli ishga tushmadi: " + safeMessage(e)) + ");");
            }
        });
        requestStorageAccess();
    }

    private void requestStorageAccess() {
        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT <= 28 &&
                checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 41);
        }
    }

    private boolean isYoutubeUrl(String value) {
        try {
            URI uri = new URI(value.trim());
            String host = uri.getHost();
            if (host == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
            host = host.toLowerCase(Locale.ROOT);
            return host.equals("youtu.be") || host.equals("youtube.com") || host.endsWith(".youtube.com");
        } catch (Exception e) { return false; }
    }

    private void js(String expression) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(expression, null); });
    }

    private void log(String message) { js("window.onLog(" + JSONObject.quote(message == null ? "" : message) + ");"); }
    private static String safeMessage(Exception e) {
        String s = e.getMessage();
        return s == null || s.trim().isEmpty() ? e.getClass().getSimpleName() : s;
    }

    private class Bridge {
        @JavascriptInterface public void inspect(String rawUrl) {
            final String url = rawUrl == null ? "" : rawUrl.trim();
            if (!isYoutubeUrl(url)) { js("window.onError('Faqat HTTPS YouTube yoki youtu.be havolasini kiriting.');"); return; }
            if (!engineReady) { js("window.onError('Yuklash moduli tayyor bo‘lishini kuting.');"); return; }
            if (busy) { js("window.onError('Yuklab olish davom etmoqda.');"); return; }
            js("window.onBusy(true,'Havola tekshirilmoqda…');");
            worker.execute(() -> {
                try {
                    log("Havola tekshirilmoqda: " + url);
                    VideoInfo info = YoutubeDL.getInstance().getInfo(url);
                    ArrayList<VideoFormat> sourceFormats = info.getFormats();
                    TreeSet<Integer> heights = new TreeSet<>(Collections.reverseOrder());
                    if (sourceFormats != null) for (VideoFormat f : sourceFormats) {
                        if (f.getHeight() > 0 && f.getVcodec() != null && !"none".equals(f.getVcodec())) heights.add(f.getHeight());
                    }
                    JSONArray options = new JSONArray();
                    checkedChoices.clear();
                    for (Integer h : heights) {
                        String id = "video-" + h;
                        String label = (h >= 2160 ? "4K" : h >= 1080 ? "Full HD" : h >= 720 ? "HD" : "Kichik format") + " · " + h + "p";
                        JSONObject item = new JSONObject(); item.put("id", id); item.put("label", label); options.put(item); checkedChoices.add(id);
                        if (options.length() >= 10) break;
                    }
                    JSONObject mp3 = new JSONObject(); mp3.put("id", "mp3"); mp3.put("label", "MP3 · audio"); options.put(mp3); checkedChoices.add("mp3");
                    checkedUrl = url;
                    JSONObject result = new JSONObject();
                    result.put("title", info.getTitle() == null ? "YouTube video" : info.getTitle());
                    result.put("duration", info.getDuration() > 0 ? String.format(Locale.ROOT, "%d:%02d", info.getDuration()/60, info.getDuration()%60) : "");
                    result.put("formats", options);
                    js("window.onFormats(" + JSONObject.quote(result.toString()) + ");");
                    log("Topildi: " + result.optString("title") + " · " + heights.size() + " xil video sifati va MP3");
                } catch (Exception e) {
                    checkedUrl = ""; checkedChoices.clear();
                    js("window.onError(" + JSONObject.quote("Tekshirishda xatolik: " + safeMessage(e)) + ");");
                } finally { js("window.onBusy(false,'Tayyor');"); }
            });
        }

        @JavascriptInterface public void download(String rawUrl, String selectedFormat) {
            final String url = rawUrl == null ? "" : rawUrl.trim();
            final String format = selectedFormat == null ? "" : selectedFormat;
            if (!isYoutubeUrl(url) || !url.equals(checkedUrl) || !checkedChoices.contains(format)) {
                js("window.onError('Havolani qayta tekshirib, formatni qaytadan tanlang.');"); return;
            }
            if (!engineReady || busy) { js("window.onError('Hozir boshqa ish bajarilmoqda yoki modul tayyor emas.');"); return; }
            busy = true;
            js("window.onBusy(true,'Yuklab olinmoqda…');");
            worker.execute(() -> {
                try {
                    File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "FileG");
                    if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Downloads/FileG papkasini yaratib bo‘lmadi.");
                    YoutubeDLRequest request = new YoutubeDLRequest(url);
                    request.addOption("--no-mtime"); request.addOption("--no-playlist"); request.addOption("--newline");
                    request.addOption("-o", new File(folder, "%(title).180B [%(id)s].%(ext)s").getAbsolutePath());
                    if ("mp3".equals(format)) {
                        request.addOption("-x"); request.addOption("--audio-format", "mp3"); request.addOption("--audio-quality", "0");
                    } else {
                        int height = Integer.parseInt(format.substring("video-".length()));
                        request.addOption("-f", "bestvideo[height<=" + height + "]+bestaudio/best[height<=" + height + "]");
                        request.addOption("--merge-output-format", "mp4");
                    }
                    log("Yuklab olish boshlandi. Saqlanadigan joy: Downloads/FileG");
                    YoutubeDL.getInstance().execute(request, null, (progress, eta, line) -> { if (line != null && !line.trim().isEmpty()) log(line); return Unit.INSTANCE; });
                    log("Yuklash tugadi. Downloads/FileG papkasidan topasiz.");
                    js("window.onDownloadDone('Downloads/FileG');");
                } catch (Exception e) {
                    js("window.onError(" + JSONObject.quote("Yuklashda xatolik: " + safeMessage(e)) + ");");
                } finally { busy = false; js("window.onBusy(false,'Tayyor');"); }
            });
        }
    }

    @Override protected void onDestroy() { if (web != null) web.destroy(); worker.shutdownNow(); super.onDestroy(); }
}

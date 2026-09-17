package uz.asadbek.goldwidget;

import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.os.*;
import android.widget.RemoteViews;
import java.io.*;
import java.net.*;
import java.text.*;
import java.util.*;
import org.json.*;

public class PriceService extends Service {
    private static final String CHANNEL = "gold_live";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean running;
    private boolean once;
    private final Runnable loop = new Runnable() {
        @Override public void run() {
            if (!running) return;
            new Thread(() -> fetchAndUpdate()).start();
            if (!once) handler.postDelayed(this, 10_000);
        }
    };

    @Override public void onCreate() { super.onCreate(); createChannel(); }

    @Override public int onStartCommand(Intent intent, int flags, int id) {
        once = intent != null && intent.getBooleanExtra("once", false);
        running = true;
        startForeground(1001, notification("XAUUSD ulanmoqda…"));
        handler.removeCallbacks(loop);
        handler.post(loop);
        return once ? START_NOT_STICKY : START_STICKY;
    }

    @Override public void onDestroy() {
        running = false; handler.removeCallbacks(loop); super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }

    private void fetchAndUpdate() {
        HttpURLConnection c = null;
        try {
            URL u = new URL("https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?interval=1m&range=1d");
            c = (HttpURLConnection)u.openConnection();
            c.setConnectTimeout(8000); c.setReadTimeout(8000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 GoldWidget/1.0");
            StringBuilder b = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
                String line; while ((line = r.readLine()) != null) b.append(line);
            }
            JSONObject meta = new JSONObject(b.toString()).getJSONObject("chart")
                .getJSONArray("result").getJSONObject(0).getJSONObject("meta");
            double raw = meta.getDouble("regularMarketPrice");
            double prevClose = meta.optDouble("chartPreviousClose", raw);
            float adjustment = getSharedPreferences("gold", MODE_PRIVATE).getFloat("offset", 0f);
            double price = raw + adjustment;
            double change = price - (prevClose + adjustment);
            String value = new DecimalFormat("#,##0.00").format(price);
            String delta = (change >= 0 ? "+" : "") + new DecimalFormat("#,##0.00").format(change);
            String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
            updateWidgets(value, delta, change >= 0, time);
            getSystemService(NotificationManager.class).notify(1001, notification("XAUUSD  " + value));
        } catch (Exception e) {
            updateWidgets("—", "Aloqa xatosi", false,
                new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date()));
        } finally {
            if (c != null) c.disconnect();
            if (once) { running = false; stopSelf(); }
        }
    }

    private void updateWidgets(String price, String delta, boolean up, String time) {
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        int[] ids = m.getAppWidgetIds(new ComponentName(this, GoldWidgetProvider.class));
        for (int id : ids) {
            RemoteViews v = new RemoteViews(getPackageName(), R.layout.widget_gold);
            v.setTextViewText(R.id.widgetPrice, price);
            v.setTextViewText(R.id.widgetTime, time);
            v.setTextViewText(R.id.widgetChange, delta);
            v.setTextColor(R.id.widgetChange, getColor(up ? R.color.up : R.color.down));
            Intent refresh = new Intent(this, GoldWidgetProvider.class)
                .setAction("uz.asadbek.goldwidget.REFRESH");
            PendingIntent rpi = PendingIntent.getBroadcast(this, id, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.refresh, rpi);
            Intent open = new Intent(this, MainActivity.class);
            PendingIntent opi = PendingIntent.getActivity(this, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.widgetBody, opi);
            m.updateAppWidget(id, v);
        }
    }

    private Notification notification(String text) {
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_gold)
            .setContentTitle("Gold Widget").setContentText(text).setOngoing(true)
            .setContentIntent(pi).build();
    }
    private void createChannel() {
        NotificationChannel ch = new NotificationChannel(CHANNEL, "XAUUSD jonli narxi",
            NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
}

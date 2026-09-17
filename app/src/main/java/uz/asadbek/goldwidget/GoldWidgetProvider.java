package uz.asadbek.goldwidget;

import android.appwidget.*;
import android.content.*;
import android.os.Build;
import android.widget.RemoteViews;

public class GoldWidgetProvider extends AppWidgetProvider {
    private static void startPriceService(Context context, boolean once) {
        try {
            Intent service = new Intent(context, PriceService.class).putExtra("once", once);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(service);
            } else {
                context.startService(service);
            }
        } catch (RuntimeException ignored) {
            // Android may temporarily block a foreground service from a launcher broadcast.
            // Opening the app starts it again without preventing the widget from being added.
        }
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if ("uz.asadbek.goldwidget.REFRESH".equals(intent.getAction())) {
            startPriceService(context, true);
        }
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_gold);
            views.setTextViewText(R.id.widgetPrice, "Ulanmoqda...");
            views.setTextViewText(R.id.widgetChange, "Ilovani bir marta oching");
            manager.updateAppWidget(id, views);
        }
        context.getSharedPreferences("gold", Context.MODE_PRIVATE)
            .edit().putBoolean("enabled", true).apply();
        startPriceService(context, false);
    }

    @Override public void onDisabled(Context context) {
        context.getSharedPreferences("gold", Context.MODE_PRIVATE)
            .edit().putBoolean("enabled", false).apply();
        context.stopService(new Intent(context, PriceService.class));
    }
}

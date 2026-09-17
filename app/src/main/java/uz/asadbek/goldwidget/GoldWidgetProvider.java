package uz.asadbek.goldwidget;

import android.appwidget.*;
import android.content.*;
import android.widget.RemoteViews;

public class GoldWidgetProvider extends AppWidgetProvider {
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if ("uz.asadbek.goldwidget.REFRESH".equals(intent.getAction())) {
            context.startForegroundService(new Intent(context, PriceService.class).putExtra("once", true));
        }
    }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_gold);
            v.setTextViewText(R.id.widgetPrice, "Ulanmoqda…");
            manager.updateAppWidget(id, v);
        }
        context.getSharedPreferences("gold", Context.MODE_PRIVATE).edit().putBoolean("enabled", true).apply();
        context.startForegroundService(new Intent(context, PriceService.class));
    }
    @Override public void onDisabled(Context context) {
        context.getSharedPreferences("gold", Context.MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
        context.stopService(new Intent(context, PriceService.class));
    }
}

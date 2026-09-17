package uz.asadbek.goldwidget;
import android.content.*;
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (c.getSharedPreferences("gold", Context.MODE_PRIVATE).getBoolean("enabled", false)) {
            try { c.startForegroundService(new Intent(c, PriceService.class)); } catch (Exception ignored) {}
        }
    }
}

package uz.asadbek.goldwidget;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;

public class MainActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);

        getSharedPreferences("gold", MODE_PRIVATE).edit().putBoolean("enabled", true).apply();
        startForegroundService(new Intent(this, PriceService.class));

        findViewById(R.id.battery).setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        });
    }
}

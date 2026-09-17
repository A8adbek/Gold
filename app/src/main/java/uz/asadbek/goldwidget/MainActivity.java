package uz.asadbek.goldwidget;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.*;

public class MainActivity extends Activity {
    private EditText offset;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        offset = findViewById(R.id.offset);
        SharedPreferences p = getSharedPreferences("gold", MODE_PRIVATE);
        offset.setText(String.valueOf(p.getFloat("offset", 0f)));
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);

        findViewById(R.id.start).setOnClickListener(v -> {
            try {
                float value = Float.parseFloat(offset.getText().toString().trim());
                p.edit().putFloat("offset", value).putBoolean("enabled", true).apply();
                startForegroundService(new Intent(this, PriceService.class));
                Toast.makeText(this, "Jonli yangilanish yoqildi", Toast.LENGTH_SHORT).show();
            } catch (NumberFormatException e) { offset.setError("Masalan: 0.00 yoki -1.25"); }
        });
        findViewById(R.id.stop).setOnClickListener(v -> {
            p.edit().putBoolean("enabled", false).apply();
            stopService(new Intent(this, PriceService.class));
        });
        findViewById(R.id.battery).setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
        });
    }
}

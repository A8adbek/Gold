package uz.asadbek.notebookcave;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Local-only game: no network permission, SDKs or JavaScript/native bridge. */
public final class GameActivity extends Activity {
    private WebView game;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        game = new WebView(this);
        game.setBackgroundColor(0xffeeedeb);
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setDomStorageEnabled(true);
        game.getSettings().setMediaPlaybackRequiresUserGesture(false);
        game.getSettings().setAllowFileAccess(true);
        game.getSettings().setAllowContentAccess(false);
        game.getSettings().setAllowFileAccessFromFileURLs(false);
        game.getSettings().setAllowUniversalAccessFromFileURLs(false);
        game.setWebViewClient(new WebViewClient());
        setContentView(game);
        game.loadUrl("file:///android_asset/index.html");
    }
    @Override protected void onPause() {
        game.evaluateJavascript("window.pauseGame && window.pauseGame()", null);
        game.onPause();
        game.pauseTimers();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (game != null) { game.onResume(); game.resumeTimers(); }
    }
    @Override protected void onDestroy() {
        game.destroy();
        super.onDestroy();
    }
}

package lk.btexpress.buspal;

import android.app.Application;
import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.util.ThemeManager;

public class BusPalApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        // Applied here, before any Activity is created, so the whole app
        // launches already in the right theme — no flash of the other one.
        ThemeManager.applySavedTheme(this);
        ApiClient.init(this);
    }
}

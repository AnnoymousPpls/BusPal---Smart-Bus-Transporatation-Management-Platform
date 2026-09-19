package lk.btexpress.buspal.util;

import android.content.Context;
import android.content.SharedPreferences;

/** Holds the JWT + basic profile info once logged in — the Android-side equivalent of the web's AuthStore session. */
public class SessionManager {

    private static final String PREFS = "buspal_session";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_NAME = "name";
    private static final String KEY_EMAIL = "email";
    private static final String KEY_ID = "id";

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void save(String token, long id, String name, String email) {
        prefs.edit()
                .putString(KEY_TOKEN, token)
                .putLong(KEY_ID, id)
                .putString(KEY_NAME, name)
                .putString(KEY_EMAIL, email)
                .apply();
    }

    public String getToken() { return prefs.getString(KEY_TOKEN, null); }
    public long getUserId() { return prefs.getLong(KEY_ID, -1); }
    public String getName() { return prefs.getString(KEY_NAME, ""); }
    public String getEmail() { return prefs.getString(KEY_EMAIL, ""); }
    public boolean isLoggedIn() { return getToken() != null; }

    public void clear() {
        prefs.edit().clear().apply();
    }
}

package com.ttrims.driver.utils;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.ttrims.driver.models.User;

/**
 * SharedPreferences-backed session store for the driver app.
 *
 * Because this is a permanently-installed native APK, the session is NEVER
 * automatically cleared on network errors — only an explicit logout() call
 * removes the tokens.
 */
public class SessionManager {

    private static final String PREF_NAME   = "ttrims_driver_session";
    private static final String KEY_TOKEN   = "accessToken";
    private static final String KEY_REFRESH = "refreshToken";
    private static final String KEY_USER    = "user_json";
    private static final String KEY_CUSTOM_URL = "customApiUrl";

    private static SessionManager instance;
    private final SharedPreferences prefs;
    private final Gson gson = new Gson();

    private SessionManager(Context ctx) {
        prefs = ctx.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized SessionManager getInstance(Context ctx) {
        if (instance == null) instance = new SessionManager(ctx.getApplicationContext());
        return instance;
    }

    // ── Tokens ──────────────────────────────────────────────────────────────────

    public void saveTokens(String accessToken, String refreshToken) {
        prefs.edit()
                .putString(KEY_TOKEN, accessToken)
                .putString(KEY_REFRESH, refreshToken)
                .apply();
    }

    public String getAccessToken()  { return prefs.getString(KEY_TOKEN, null);   }
    public String getRefreshToken() { return prefs.getString(KEY_REFRESH, null); }

    // ── User ────────────────────────────────────────────────────────────────────

    public void saveUser(User user) {
        prefs.edit().putString(KEY_USER, gson.toJson(user)).apply();
    }

    public User getUser() {
        String json = prefs.getString(KEY_USER, null);
        if (json == null) return null;
        return gson.fromJson(json, User.class);
    }

    // ── Custom URL ──────────────────────────────────────────────────────────────

    public void setCustomApiUrl(String url) {
        prefs.edit().putString(KEY_CUSTOM_URL, url).apply();
    }

    public String getCustomApiUrl() { return prefs.getString(KEY_CUSTOM_URL, null); }

    // ── State ───────────────────────────────────────────────────────────────────

    public boolean isLoggedIn() {
        return getAccessToken() != null;
    }

    /**
     * Clears auth tokens and user data.
     * Called only on explicit logout — never on network errors.
     */
    public void logout() {
        prefs.edit()
                .remove(KEY_TOKEN)
                .remove(KEY_REFRESH)
                .remove(KEY_USER)
                .apply();
    }
}

package com.ttrims.warehouse;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.ttrims.warehouse.api.ApiClient;
import com.ttrims.warehouse.api.ApiService;
import com.ttrims.warehouse.models.ApiResponse;
import com.ttrims.warehouse.utils.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        SessionManager session = SessionManager.getInstance(this);

        if (!session.isLoggedIn()) {
            new Handler(Looper.getMainLooper()).postDelayed(this::goToLogin, 1200);
            return;
        }

        // Token exists — silent ping check
        ApiService api = ApiClient.getService(this);
        api.getDashboardStats().enqueue(new Callback<ApiResponse<ApiService.DashboardStats>>() {
            @Override
            public void onResponse(Call<ApiResponse<ApiService.DashboardStats>> call,
                                   Response<ApiResponse<ApiService.DashboardStats>> response) {
                if (response.isSuccessful()) {
                    goToMain();
                } else {
                    // Unauthorized or server error — clear tokens and login
                    session.clearSession();
                    Toast.makeText(SplashActivity.this, "Session expired", Toast.LENGTH_SHORT).show();
                    goToLogin();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<ApiService.DashboardStats>> call, Throwable t) {
                // Keep the current session if it is a network problem (permanent session requirement)
                Toast.makeText(SplashActivity.this, "Offline Mode Active", Toast.LENGTH_SHORT).show();
                goToMain();
            }
        });
    }

    private void goToLogin() {
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }
}

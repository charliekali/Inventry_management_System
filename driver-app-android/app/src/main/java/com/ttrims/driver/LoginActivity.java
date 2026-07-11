package com.ttrims.driver;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.ttrims.driver.api.ApiClient;
import com.ttrims.driver.api.ApiService;
import com.ttrims.driver.databinding.ActivityLoginBinding;
import com.ttrims.driver.models.ApiResponse;
import com.ttrims.driver.utils.SessionManager;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding binding;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        session = SessionManager.getInstance(this);

        // Long-press on the login card to reveal custom server URL field
        binding.loginCard.setOnLongClickListener(v -> {
            int vis = binding.tilServerUrl.getVisibility();
            binding.tilServerUrl.setVisibility(vis == View.VISIBLE ? View.GONE : View.VISIBLE);
            String saved = session.getCustomApiUrl();
            if (saved != null && binding.etServerUrl.getText() != null
                    && binding.etServerUrl.getText().toString().isEmpty()) {
                binding.etServerUrl.setText(saved);
            }
            return true;
        });

        // IME: done on password → triggers login
        binding.etPassword.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                handleLogin();
                return true;
            }
            return false;
        });

        binding.btnLogin.setOnClickListener(v -> handleLogin());
    }

    private void handleLogin() {
        String email    = text(binding.etEmail);
        String password = text(binding.etPassword);

        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            binding.tvLoginError.setText(getString(R.string.login_error_empty));
            binding.tvLoginError.setVisibility(View.VISIBLE);
            return;
        }

        // Save custom URL if provided
        String customUrl = text(binding.etServerUrl);
        if (!customUrl.isEmpty()) {
            session.setCustomApiUrl(customUrl);
            ApiClient.invalidate();
        }

        setLoading(true);
        binding.tvLoginError.setVisibility(View.GONE);

        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);

        ApiClient.getService(this).login(body)
                .enqueue(new Callback<ApiResponse<ApiService.LoginData>>() {
                    @Override
                    public void onResponse(Call<ApiResponse<ApiService.LoginData>> call,
                                           Response<ApiResponse<ApiService.LoginData>> response) {
                        setLoading(false);
                        if (response.isSuccessful() && response.body() != null
                                && response.body().success) {
                            ApiService.LoginData d = response.body().data;
                            session.saveTokens(d.accessToken, d.refreshToken);
                            if (d.user != null) session.saveUser(d.user);
                            Toast.makeText(LoginActivity.this,
                                    "Welcome, " + (d.user != null ? d.user.name : "Driver") + "!",
                                    Toast.LENGTH_SHORT).show();
                            startActivity(new Intent(LoginActivity.this, MainActivity.class));
                            finish();
                        } else {
                            String msg = response.body() != null
                                    ? response.body().message : getString(R.string.error_server);
                            binding.tvLoginError.setText(msg != null ? msg : getString(R.string.error_unauthorized));
                            binding.tvLoginError.setVisibility(View.VISIBLE);
                        }
                    }

                    @Override
                    public void onFailure(Call<ApiResponse<ApiService.LoginData>> call, Throwable t) {
                        setLoading(false);
                        binding.tvLoginError.setText(getString(R.string.error_network));
                        binding.tvLoginError.setVisibility(View.VISIBLE);
                    }
                });
    }

    private void setLoading(boolean loading) {
        binding.btnLogin.setEnabled(!loading);
        binding.btnLogin.setText(loading ? getString(R.string.login_loading) : getString(R.string.btn_login));
        binding.loginProgress.setVisibility(loading ? View.VISIBLE : View.GONE);
    }

    private String text(TextInputEditText et) {
        return et.getText() != null ? et.getText().toString().trim() : "";
    }
}

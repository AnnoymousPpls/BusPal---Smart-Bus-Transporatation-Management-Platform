package lk.btexpress.buspal.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import androidx.appcompat.app.AppCompatActivity;

import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.ActivityLoginBinding;
import lk.btexpress.buspal.main.MainActivity;
import lk.btexpress.buspal.model.AuthResponse;
import lk.btexpress.buspal.model.LoginRequest;
import lk.btexpress.buspal.util.SessionManager;
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
        session = new SessionManager(this);

        binding.loginButton.setOnClickListener(v -> attemptLogin());
        binding.registerLinkButton.setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));
    }

    private void attemptLogin() {
        String email = text(binding.emailInput);
        String password = text(binding.passwordInput);

        if (email.isEmpty() || password.isEmpty()) {
            showError("Enter both email and password.");
            return;
        }

        setLoading(true);
        ApiClient.getService().login(new LoginRequest(email, password)).enqueue(new Callback<ApiResponse<AuthResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<AuthResponse>> call, Response<ApiResponse<AuthResponse>> response) {
                setLoading(false);
                if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                    AuthResponse auth = response.body().data;
                    if (!"PASSENGER".equalsIgnoreCase(auth.role)) {
                        showError("This app is for passengers — operator accounts use the web dashboard.");
                        return;
                    }
                    session.save(auth.token, auth.accountId, auth.name, auth.email);
                    startActivity(new Intent(LoginActivity.this, MainActivity.class));
                    finish();
                } else {
                    showError(response.body() != null && response.body().message != null
                            ? response.body().message : "Incorrect email or password.");
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<AuthResponse>> call, Throwable t) {
                setLoading(false);
                showError("Couldn't reach the server. Check your connection and the API URL in build.gradle.");
            }
        });
    }

    private void setLoading(boolean loading) {
        binding.loadingSpinner.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.loginButton.setEnabled(!loading);
    }

    private void showError(String msg) {
        binding.errorText.setText(msg);
        binding.errorText.setVisibility(View.VISIBLE);
    }

    private String text(com.google.android.material.textfield.TextInputEditText input) {
        return input.getText() != null ? input.getText().toString().trim() : "";
    }
}

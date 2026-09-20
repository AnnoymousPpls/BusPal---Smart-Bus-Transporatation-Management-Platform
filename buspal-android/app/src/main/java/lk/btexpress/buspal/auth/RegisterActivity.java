package lk.btexpress.buspal.auth;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import androidx.appcompat.app.AppCompatActivity;

import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.ActivityRegisterBinding;
import lk.btexpress.buspal.main.MainActivity;
import lk.btexpress.buspal.model.AuthResponse;
import lk.btexpress.buspal.model.RegisterRequest;
import lk.btexpress.buspal.util.SessionManager;
import lk.btexpress.buspal.util.ValidationHelper;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private ActivityRegisterBinding binding;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        session = new SessionManager(this);

        // Live password strength label — same thresholds as the website's meter.
        binding.passwordInput.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {
                binding.strengthLabel.setText(s.length() == 0 ? "" :
                        "Password strength: " + ValidationHelper.passwordStrengthLabel(s.toString()));
            }
            @Override public void afterTextChanged(Editable s) { }
        });

        binding.registerButton.setOnClickListener(v -> attemptRegister());
    }

    private void attemptRegister() {
        String name = text(binding.nameInput);
        String phone = text(binding.phoneInput);
        String email = text(binding.emailInput);
        String password = text(binding.passwordInput);

        if (name.isEmpty()) { showError("Enter your full name."); return; }
        if (!ValidationHelper.isValidPhone(phone)) { showError("Enter a valid mobile number, e.g. 0771234567."); return; }
        if (!ValidationHelper.isValidEmail(email)) { showError("Enter a valid email address."); return; }
        if (ValidationHelper.isWeakPassword(password)) { showError("Password is too weak — add a number, a symbol, or make it longer."); return; }

        setLoading(true);
        ApiClient.getService().register(new RegisterRequest(name, email, phone, password))
                .enqueue(new Callback<ApiResponse<AuthResponse>>() {
                    @Override
                    public void onResponse(Call<ApiResponse<AuthResponse>> call, Response<ApiResponse<AuthResponse>> response) {
                        setLoading(false);
                        if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                            AuthResponse auth = response.body().data;
                            session.save(auth.token, auth.accountId, auth.name, auth.email);
                            startActivity(new Intent(RegisterActivity.this, MainActivity.class));
                            finish();
                        } else {
                            showError(response.body() != null && response.body().message != null
                                    ? response.body().message : "Couldn't create your account — try a different email.");
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
        binding.registerButton.setEnabled(!loading);
    }

    private void showError(String msg) {
        binding.errorText.setText(msg);
        binding.errorText.setVisibility(View.VISIBLE);
    }

    private String text(com.google.android.material.textfield.TextInputEditText input) {
        return input.getText() != null ? input.getText().toString().trim() : "";
    }
}

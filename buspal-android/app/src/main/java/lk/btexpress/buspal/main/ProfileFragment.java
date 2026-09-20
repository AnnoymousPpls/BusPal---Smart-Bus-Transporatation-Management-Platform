package lk.btexpress.buspal.main;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.util.List;

import lk.btexpress.buspal.R;
import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.auth.LoginActivity;
import lk.btexpress.buspal.databinding.FragmentProfileBinding;
import lk.btexpress.buspal.model.ChangePasswordRequest;
import lk.btexpress.buspal.model.EmergencyContact;
import lk.btexpress.buspal.model.FeedbackRequest;
import lk.btexpress.buspal.model.FeedbackResponse;
import lk.btexpress.buspal.util.SessionManager;
import lk.btexpress.buspal.util.ThemeManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private FragmentProfileBinding binding;
    private SessionManager session;

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState) {

        binding = FragmentProfileBinding.inflate(
                inflater,
                container,
                false
        );

        return binding.getRoot();
    }

    @Override
    public void onViewCreated(
            @NonNull View view,
            @Nullable Bundle savedInstanceState) {

        super.onViewCreated(view, savedInstanceState);

        session = new SessionManager(requireContext());

        // ==========================================
        // PROFILE INFORMATION
        // ==========================================

        binding.nameText.setText(session.getName());
        binding.emailText.setText(session.getEmail());

        binding.fullNameLabel.setText(session.getName());
        binding.emailLabel.setText(session.getEmail());


        // ==========================================
        // DARK THEME
        // ==========================================

        binding.themeSwitch.setChecked(
                ThemeManager.isCurrentlyDark(requireContext())
        );

        binding.themeSwitch.setOnCheckedChangeListener(
                (buttonView, isChecked) ->
                        ThemeManager.setMode(
                                requireContext(),
                                isChecked ? "dark" : "light"
                        )
        );


        // ==========================================
        // CHANGE PASSWORD
        // ==========================================

        binding.changePasswordButton.setOnClickListener(
                v -> showChangePasswordDialog()
        );


        // ==========================================
        // EMERGENCY CONTACTS
        // ==========================================

        binding.addEmergencyContactButton.setOnClickListener(
                v -> showAddEmergencyContactDialog()
        );

        loadEmergencyContacts();


        // ==========================================
        // FEEDBACK
        // ==========================================

        binding.feedbackButton.setOnClickListener(
                v -> showFeedbackDialog()
        );


        // ==========================================
        // LOGOUT
        // ==========================================

        binding.logoutButton.setOnClickListener(
                v -> logout()
        );
    }


    // =================================================
    // EMERGENCY CONTACTS
    // =================================================

    private void loadEmergencyContacts() {

        ApiClient.getService()
                .getEmergencyContacts()
                .enqueue(
                        new Callback<ApiResponse<List<EmergencyContact>>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<List<EmergencyContact>>> call,
                                    Response<ApiResponse<List<EmergencyContact>>> response) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success) {

                                    List<EmergencyContact> contacts =
                                            response.body().data;

                                    displayEmergencyContacts(contacts);

                                } else {

                                    Toast.makeText(
                                            requireContext(),
                                            "Couldn't load emergency contacts.",
                                            Toast.LENGTH_SHORT
                                    ).show();
                                }
                            }

                            @Override
                            public void onFailure(
                                    Call<ApiResponse<List<EmergencyContact>>> call,
                                    Throwable t) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                Toast.makeText(
                                        requireContext(),
                                        "Couldn't load emergency contacts. Check your connection.",
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                );
    }


    private void displayEmergencyContacts(
            List<EmergencyContact> contacts) {

        binding.emergencyContactsContainer.removeAllViews();

        if (contacts == null || contacts.isEmpty()) {

            TextView emptyText =
                    new TextView(requireContext());

            emptyText.setText(
                    "No emergency contacts added yet."
            );

            emptyText.setTextColor(
                    getResources().getColor(
                            lk.btexpress.buspal.R.color.text_muted
                    )
            );

            emptyText.setTextSize(13);

            emptyText.setPadding(
                    0,
                    8,
                    0,
                    8
            );

            binding.emergencyContactsContainer
                    .addView(emptyText);

            return;
        }


        for (EmergencyContact contact : contacts) {

            addContactView(contact);
        }
    }


    private void addContactView(
            EmergencyContact contact) {

        MaterialCardView card =
                new MaterialCardView(requireContext());

        LinearLayout.LayoutParams cardParams =
                new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                );

        cardParams.setMargins(
                0,
                0,
                0,
                dpToPx(8)
        );

        card.setLayoutParams(cardParams);

        card.setRadius(
                dpToPx(10)
        );

        card.setCardElevation(
                dpToPx(1)
        );


        LinearLayout row =
                new LinearLayout(requireContext());

        row.setOrientation(
                LinearLayout.HORIZONTAL
        );

        row.setGravity(
                android.view.Gravity.CENTER_VERTICAL
        );

        row.setPadding(
                dpToPx(12),
                dpToPx(10),
                dpToPx(8),
                dpToPx(10)
        );


        // ==========================================
        // NAME + PHONE
        // ==========================================

        LinearLayout information =
                new LinearLayout(requireContext());

        information.setOrientation(
                LinearLayout.VERTICAL
        );

        LinearLayout.LayoutParams informationParams =
                new LinearLayout.LayoutParams(
                        0,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        1
                );

        information.setLayoutParams(
                informationParams
        );


        TextView name =
                new TextView(requireContext());

        name.setText(
                contact.getName()
        );

        name.setTextColor(
                getResources().getColor(
                        R.color.text_primary
                )
        );

        name.setTextSize(15);

        name.setTypeface(
                null,
                android.graphics.Typeface.BOLD
        );


        TextView phone =
                new TextView(requireContext());

        phone.setText(
                contact.getPhone()
        );

        phone.setTextColor(
                getResources().getColor(
                        R.color.text_muted
                )
        );

        phone.setTextSize(13);

        phone.setPadding(
                0,
                dpToPx(3),
                0,
                0
        );


        information.addView(name);
        information.addView(phone);


        // ==========================================
        // DELETE BUTTON
        // ==========================================

        MaterialButton deleteButton = new MaterialButton(requireContext());

        deleteButton.setText("Delete");

        deleteButton.setTextSize(12);

        deleteButton.setTextColor(
                android.graphics.Color.RED
        );

        deleteButton.setAllCaps(false);

        deleteButton.setOnClickListener(
                v -> confirmDeleteContact(contact)
        );


        row.addView(information);
        row.addView(deleteButton);

        card.addView(row);

        binding.emergencyContactsContainer
                .addView(card);
    }


    private void showAddEmergencyContactDialog() {

        LinearLayout wrapper =
                new LinearLayout(requireContext());

        wrapper.setOrientation(
                LinearLayout.VERTICAL
        );

        int padding =
                dpToPx(20);

        wrapper.setPadding(
                padding,
                0,
                padding,
                0
        );


        EditText nameInput =
                new EditText(requireContext());

        nameInput.setHint(
                "Contact name"
        );

        nameInput.setSingleLine(true);


        EditText phoneInput =
                new EditText(requireContext());

        phoneInput.setHint(
                "Phone number"
        );

        phoneInput.setSingleLine(true);

        phoneInput.setInputType(
                InputType.TYPE_CLASS_PHONE
        );


        wrapper.addView(nameInput);
        wrapper.addView(phoneInput);


        AlertDialog dialog =
                new AlertDialog.Builder(
                        requireContext()
                )
                        .setTitle(
                                "Add emergency contact"
                        )
                        .setMessage(
                                "Add someone you trust to contact during an emergency."
                        )
                        .setView(wrapper)
                        .setNegativeButton(
                                "Cancel",
                                null
                        )
                        .setPositiveButton(
                                "Add",
                                null
                        )
                        .create();


        dialog.setOnShowListener(
                d -> {

                    dialog.getButton(
                            AlertDialog.BUTTON_POSITIVE
                    ).setOnClickListener(
                            v -> {

                                String name =
                                        nameInput
                                                .getText()
                                                .toString()
                                                .trim();

                                String phone =
                                        phoneInput
                                                .getText()
                                                .toString()
                                                .trim();


                                if (name.isEmpty()) {

                                    nameInput.setError(
                                            "Enter contact name."
                                    );

                                    return;
                                }


                                if (phone.isEmpty()) {

                                    phoneInput.setError(
                                            "Enter phone number."
                                    );

                                    return;
                                }


                                if (!isValidSriLankanMobile(
                                        phone)) {

                                    phoneInput.setError(
                                            "Enter a valid mobile number, e.g. 0771234567."
                                    );

                                    return;
                                }


                                addEmergencyContact(
                                        dialog,
                                        name,
                                        phone
                                );
                            }
                    );
                }
        );


        dialog.show();
    }


    private boolean isValidSriLankanMobile(
            String phone) {

        String cleaned =
                phone.replace(
                        " ",
                        ""
                ).replace(
                        "-",
                        ""
                );


        return cleaned.matches(
                "^(?:\\+94|0)7\\d{8}$"
        );
    }


    private void addEmergencyContact(
            AlertDialog dialog,
            String name,
            String phone) {

        dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
        ).setEnabled(false);


        EmergencyContact contact =
                new EmergencyContact(
                        name,
                        phone
                );


        ApiClient.getService()
                .addEmergencyContact(contact)
                .enqueue(
                        new Callback<ApiResponse<EmergencyContact>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<EmergencyContact>> call,
                                    Response<ApiResponse<EmergencyContact>> response) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success) {

                                    dialog.dismiss();

                                    Toast.makeText(
                                            requireContext(),
                                            "Emergency contact added.",
                                            Toast.LENGTH_SHORT
                                    ).show();

                                    loadEmergencyContacts();

                                } else {

                                    dialog.getButton(
                                            AlertDialog.BUTTON_POSITIVE
                                    ).setEnabled(true);

                                    String error =
                                            ApiClient.extractError(
                                                    response
                                            );

                                    Toast.makeText(
                                            requireContext(),
                                            "Couldn't add contact: " + error,
                                            Toast.LENGTH_LONG
                                    ).show();
                                }
                            }

                            @Override
                            public void onFailure(
                                    Call<ApiResponse<EmergencyContact>> call,
                                    Throwable t) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                dialog.getButton(
                                        AlertDialog.BUTTON_POSITIVE
                                ).setEnabled(true);

                                Toast.makeText(
                                        requireContext(),
                                        "Couldn't add contact. Check your connection.",
                                        Toast.LENGTH_LONG
                                ).show();
                            }
                        }
                );
    }


    private void confirmDeleteContact(
            EmergencyContact contact) {

        new AlertDialog.Builder(
                requireContext()
        )
                .setTitle(
                        "Remove contact?"
                )
                .setMessage(
                        "Remove " + contact.getName()
                                + " from your emergency contacts?"
                )
                .setNegativeButton(
                        "Cancel",
                        null
                )
                .setPositiveButton(
                        "Remove",
                        (dialog, which) ->
                                deleteEmergencyContact(
                                        contact
                                )
                )
                .show();
    }


    private void deleteEmergencyContact(
            EmergencyContact contact) {

        ApiClient.getService()
                .deleteEmergencyContact(
                        contact.getId()
                )
                .enqueue(
                        new Callback<ApiResponse<EmergencyContact>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<EmergencyContact>> call,
                                    Response<ApiResponse<EmergencyContact>> response) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success) {

                                    Toast.makeText(
                                            requireContext(),
                                            "Emergency contact removed.",
                                            Toast.LENGTH_SHORT
                                    ).show();

                                    loadEmergencyContacts();

                                } else {

                                    String error =
                                            ApiClient.extractError(
                                                    response
                                            );

                                    Toast.makeText(
                                            requireContext(),
                                            "Couldn't remove contact: " + error,
                                            Toast.LENGTH_LONG
                                    ).show();
                                }
                            }

                            @Override
                            public void onFailure(
                                    Call<ApiResponse<EmergencyContact>> call,
                                    Throwable t) {

                                if (!isAdded() || binding == null) {
                                    return;
                                }

                                Toast.makeText(
                                        requireContext(),
                                        "Couldn't remove contact. Check your connection.",
                                        Toast.LENGTH_LONG
                                ).show();
                            }
                        }
                );
    }


    // =================================================
    // CHANGE PASSWORD DIALOG
    // =================================================

    private void showChangePasswordDialog() {

        LinearLayout wrapper =
                new LinearLayout(requireContext());

        wrapper.setOrientation(
                LinearLayout.VERTICAL
        );

        int padding =
                dpToPx(20);

        wrapper.setPadding(
                padding,
                0,
                padding,
                0
        );


        EditText currentPassword =
                new EditText(requireContext());

        currentPassword.setHint(
                "Current password"
        );

        currentPassword.setInputType(
                InputType.TYPE_CLASS_TEXT
                        | InputType.TYPE_TEXT_VARIATION_PASSWORD
        );


        EditText newPassword =
                new EditText(requireContext());

        newPassword.setHint(
                "New password"
        );

        newPassword.setInputType(
                InputType.TYPE_CLASS_TEXT
                        | InputType.TYPE_TEXT_VARIATION_PASSWORD
        );


        EditText confirmPassword =
                new EditText(requireContext());

        confirmPassword.setHint(
                "Confirm new password"
        );

        confirmPassword.setInputType(
                InputType.TYPE_CLASS_TEXT
                        | InputType.TYPE_TEXT_VARIATION_PASSWORD
        );


        wrapper.addView(currentPassword);
        wrapper.addView(newPassword);
        wrapper.addView(confirmPassword);


        AlertDialog dialog =
                new AlertDialog.Builder(
                        requireContext()
                )
                        .setTitle(
                                "Change password"
                        )
                        .setMessage(
                                "Your new password must be at least 8 characters."
                        )
                        .setView(wrapper)
                        .setNegativeButton(
                                "Cancel",
                                null
                        )
                        .setPositiveButton(
                                "Update password",
                                null
                        )
                        .create();


        dialog.setOnShowListener(
                d -> {

                    dialog.getButton(
                            AlertDialog.BUTTON_POSITIVE
                    ).setOnClickListener(
                            v -> {

                                String current =
                                        currentPassword
                                                .getText()
                                                .toString()
                                                .trim();

                                String newPass =
                                        newPassword
                                                .getText()
                                                .toString()
                                                .trim();

                                String confirm =
                                        confirmPassword
                                                .getText()
                                                .toString()
                                                .trim();


                                if (current.isEmpty()) {

                                    currentPassword.setError(
                                            "Enter your current password."
                                    );

                                    return;
                                }


                                if (newPass.isEmpty()) {

                                    newPassword.setError(
                                            "Enter a new password."
                                    );

                                    return;
                                }


                                if (newPass.length() < 8) {

                                    newPassword.setError(
                                            "Password must be at least 8 characters."
                                    );

                                    return;
                                }


                                if (!newPass.equals(confirm)) {

                                    confirmPassword.setError(
                                            "Passwords do not match."
                                    );

                                    return;
                                }


                                if (newPass.equals(current)) {

                                    newPassword.setError(
                                            "New password must be different from current password."
                                    );

                                    return;
                                }


                                changePassword(
                                        dialog,
                                        current,
                                        newPass
                                );
                            }
                    );
                }
        );


        dialog.show();
    }


    // =================================================
    // CHANGE PASSWORD API
    // =================================================

    private void changePassword(
            AlertDialog dialog,
            String currentPassword,
            String newPassword) {

        dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
        ).setEnabled(false);


        ChangePasswordRequest request =
                new ChangePasswordRequest(
                        currentPassword,
                        newPassword
                );


        ApiClient.getService()
                .changePassword(request)
                .enqueue(
                        new Callback<ApiResponse<Void>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<Void>> call,
                                    Response<ApiResponse<Void>> response) {

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success) {

                                    dialog.dismiss();

                                    new AlertDialog.Builder(
                                            requireContext()
                                    )
                                            .setTitle(
                                                    "Password changed"
                                            )
                                            .setMessage(
                                                    "Your password has been changed successfully. Please log in again using your new password."
                                            )
                                            .setCancelable(false)
                                            .setPositiveButton(
                                                    "Log in",
                                                    (d, which) -> logout()
                                            )
                                            .show();

                                } else {

                                    dialog.getButton(
                                            AlertDialog.BUTTON_POSITIVE
                                    ).setEnabled(true);

                                    String error =
                                            ApiClient.extractError(
                                                    response
                                            );

                                    Toast.makeText(
                                            requireContext(),
                                            "Password change failed: "
                                                    + error,
                                            Toast.LENGTH_LONG
                                    ).show();
                                }
                            }


                            @Override
                            public void onFailure(
                                    Call<ApiResponse<Void>> call,
                                    Throwable t) {

                                dialog.getButton(
                                        AlertDialog.BUTTON_POSITIVE
                                ).setEnabled(true);

                                Toast.makeText(
                                        requireContext(),
                                        "Couldn't change password. Check your connection.",
                                        Toast.LENGTH_LONG
                                ).show();
                            }
                        }
                );
    }


    // =================================================
    // FEEDBACK
    // =================================================

    private void showFeedbackDialog() {

        EditText input =
                new EditText(requireContext());

        input.setHint(
                "Tell us what happened…"
        );

        input.setMinLines(3);


        LinearLayout wrapper =
                new LinearLayout(requireContext());

        int pad =
                dpToPx(20);

        wrapper.setPadding(
                pad,
                pad,
                pad,
                0
        );


        wrapper.addView(input);


        new AlertDialog.Builder(
                requireContext()
        )
                .setTitle(
                        "Send feedback"
                )
                .setView(wrapper)
                .setPositiveButton(
                        "Submit",
                        (dialog, which) -> {

                            String message =
                                    input.getText()
                                            .toString()
                                            .trim();

                            if (message.isEmpty()) {

                                Toast.makeText(
                                        requireContext(),
                                        "Please enter your feedback.",
                                        Toast.LENGTH_SHORT
                                ).show();

                                return;
                            }


                            ApiClient.getService()
                                    .submitFeedback(
                                            new FeedbackRequest(
                                                    "feedback",
                                                    "",
                                                    message
                                            )
                                    )
                                    .enqueue(
                                            new Callback<ApiResponse<FeedbackResponse>>() {

                                                @Override
                                                public void onResponse(
                                                        Call<ApiResponse<FeedbackResponse>> call,
                                                        Response<ApiResponse<FeedbackResponse>> response) {

                                                    if (response.isSuccessful()
                                                            && response.body() != null
                                                            && response.body().success) {

                                                        Toast.makeText(
                                                                requireContext(),
                                                                "Feedback submitted successfully.",
                                                                Toast.LENGTH_LONG
                                                        ).show();

                                                    } else {

                                                        String error =
                                                                ApiClient.extractError(
                                                                        response
                                                                );

                                                        Toast.makeText(
                                                                requireContext(),
                                                                "Couldn't submit feedback: "
                                                                        + error,
                                                                Toast.LENGTH_LONG
                                                        ).show();
                                                    }
                                                }


                                                @Override
                                                public void onFailure(
                                                        Call<ApiResponse<FeedbackResponse>> call,
                                                        Throwable t) {

                                                    Toast.makeText(
                                                            requireContext(),
                                                            "Couldn't submit feedback. Check your connection.",
                                                            Toast.LENGTH_LONG
                                                    ).show();
                                                }
                                            }
                                    );
                        }
                )
                .setNegativeButton(
                        "Cancel",
                        null
                )
                .show();
    }


    // =================================================
    // LOGOUT
    // =================================================

    private void logout() {

        session.clear();

        Intent intent =
                new Intent(
                        requireContext(),
                        LoginActivity.class
                );

        intent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TASK
        );

        startActivity(intent);

        requireActivity().finish();
    }


    // =================================================
    // UTILITY
    // =================================================

    private int dpToPx(int dp) {

        return (int) (
                dp *
                        getResources()
                                .getDisplayMetrics()
                                .density
        );
    }


    // =================================================
    // DESTROY VIEW
    // =================================================

    @Override
    public void onDestroyView() {

        super.onDestroyView();

        binding = null;
    }
}
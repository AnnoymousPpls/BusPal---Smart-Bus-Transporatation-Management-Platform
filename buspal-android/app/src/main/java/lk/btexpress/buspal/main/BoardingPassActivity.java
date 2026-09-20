package lk.btexpress.buspal.main;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

import com.google.gson.Gson;

import lk.btexpress.buspal.databinding.ActivityBoardingPassBinding;
import lk.btexpress.buspal.model.Booking;

public class BoardingPassActivity extends AppCompatActivity {

    public static final String EXTRA_BOOKING = "extra_booking";

    private ActivityBoardingPassBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityBoardingPassBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        Booking b = new Gson().fromJson(getIntent().getStringExtra(EXTRA_BOOKING), Booking.class);

        binding.routeText.setText(b.from + " → " + b.to);
        binding.dateText.setText(b.date);
        binding.timeText.setText(b.depTime);
        binding.seatsText.setText(android.text.TextUtils.join(", ", b.seats));
        binding.busText.setText(b.busPlate);
        binding.classText.setText(b.busType);
        binding.pnrText.setText("PNR " + b.pnr);

        binding.doneButton.setOnClickListener(v -> finish());
    }
}

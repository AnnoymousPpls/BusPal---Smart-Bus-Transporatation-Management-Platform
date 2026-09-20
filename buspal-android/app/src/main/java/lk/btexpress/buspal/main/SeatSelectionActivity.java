package lk.btexpress.buspal.main;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.gson.Gson;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import lk.btexpress.buspal.R;
import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.ActivitySeatSelectionBinding;
import lk.btexpress.buspal.model.Booking;
import lk.btexpress.buspal.model.BookingRequest;
import lk.btexpress.buspal.model.Trip;
import lk.btexpress.buspal.util.SeatLayoutHelper;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SeatSelectionActivity extends AppCompatActivity {

    public static final String EXTRA_TRIP = "extra_trip";

    private ActivitySeatSelectionBinding binding;
    private Trip trip;
    private final Set<String> selectedSeats = new HashSet<>();
    private final java.util.Map<String, TextView> seatViews = new java.util.HashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivitySeatSelectionBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String tripJson = getIntent().getStringExtra(EXTRA_TRIP);
        trip = new Gson().fromJson(tripJson, Trip.class);

        binding.tripHeaderText.setText(trip.from + " → " + trip.to);
        binding.tripSubText.setText(trip.date + " · " + trip.depTime + " departure · " + trip.busType);

        buildSeatMap();
        binding.confirmButton.setOnClickListener(v -> confirmBooking());
    }

    private void buildSeatMap() {
        binding.seatMapContainer.removeAllViews();
        List<SeatLayoutHelper.SeatRow> rows = SeatLayoutHelper.generate(trip.seatsTotal);
        int dp8 = dp(8), dp40 = dp(40), dp16 = dp(16);

        for (SeatLayoutHelper.SeatRow row : rows) {
            LinearLayout rowLayout = new LinearLayout(this);
            rowLayout.setOrientation(LinearLayout.HORIZONTAL);
            rowLayout.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            rowParams.bottomMargin = dp8;
            rowLayout.setLayoutParams(rowParams);

            for (int i = 0; i < row.seats.size(); i++) {
                String seatId = String.valueOf(row.seats.get(i));
                TextView seat = new TextView(this);
                seat.setText(seatId);
                seat.setGravity(Gravity.CENTER);
                seat.setTextSize(11);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp40, dp(36));
                lp.setMargins(dp(3), 0, dp(3), 0);
                seat.setLayoutParams(lp);

                boolean taken = trip.seatsTaken != null && trip.seatsTaken.contains(seatId);
                styleSeat(seat, taken, false);

                if (!taken) {
                    seat.setOnClickListener(v -> toggleSeat(seatId, seat));
                }
                seatViews.put(seatId, seat);
                rowLayout.addView(seat);

                // aisle gap after the 2nd seat in a normal 2+2 row — the back bench has none
                if (row.type.equals("pair") && i == 1) {
                    View gap = new View(this);
                    gap.setLayoutParams(new LinearLayout.LayoutParams(dp16, 1));
                    rowLayout.addView(gap);
                }
            }
            binding.seatMapContainer.addView(rowLayout);
        }
    }

    private void toggleSeat(String seatId, TextView seat) {
        if (selectedSeats.contains(seatId)) {
            selectedSeats.remove(seatId);
            styleSeat(seat, false, false);
        } else {
            selectedSeats.add(seatId);
            styleSeat(seat, false, true);
        }
        updateSummary();
    }

    private void styleSeat(TextView seat, boolean taken, boolean selected) {
        if (taken) {
            seat.setBackgroundColor(Color.parseColor("#40FF6B6B"));
            seat.setTextColor(ContextCompat.getColor(this, R.color.danger));
        } else if (selected) {
            seat.setBackgroundColor(ContextCompat.getColor(this, R.color.brand));
            seat.setTextColor(ContextCompat.getColor(this, R.color.on_brand));
        } else {
            seat.setBackgroundColor(ContextCompat.getColor(this, R.color.surface_2));
            seat.setTextColor(ContextCompat.getColor(this, R.color.text_muted));
        }
    }

    private void updateSummary() {
        NumberFormat fmt = NumberFormat.getNumberInstance(Locale.US);
        if (selectedSeats.isEmpty()) {
            binding.selectedSeatsText.setText("None yet");
            binding.totalPriceText.setText("LKR 0");
            binding.confirmButton.setEnabled(false);
        } else {
            binding.selectedSeatsText.setText(android.text.TextUtils.join(", ", selectedSeats));
            binding.totalPriceText.setText("LKR " + fmt.format(trip.price * selectedSeats.size()));
            binding.confirmButton.setEnabled(true);
        }
    }

    private void confirmBooking() {
        binding.confirmButton.setEnabled(false);
        binding.loadingSpinner.setVisibility(View.VISIBLE);

        BookingRequest req = new BookingRequest(trip.departureId, trip.date, new ArrayList<>(selectedSeats));
        ApiClient.getService().createBooking(req).enqueue(new Callback<ApiResponse<Booking>>() {
            @Override
            public void onResponse(Call<ApiResponse<Booking>> call, Response<ApiResponse<Booking>> response) {
                binding.loadingSpinner.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null && response.body().data != null) {
                    Intent intent = new Intent(SeatSelectionActivity.this, BoardingPassActivity.class);
                    intent.putExtra(BoardingPassActivity.EXTRA_BOOKING, new Gson().toJson(response.body().data));
                    startActivity(intent);
                    finish();
                } else {
                    binding.confirmButton.setEnabled(true);
                    String msg = response.body() != null && response.body().message != null
                            ? response.body().message : "That seat was just taken — pick another.";
                    android.widget.Toast.makeText(SeatSelectionActivity.this, msg, android.widget.Toast.LENGTH_LONG).show();
                    buildSeatMap(); // refresh in case seats changed under us
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Booking>> call, Throwable t) {
                binding.loadingSpinner.setVisibility(View.GONE);
                binding.confirmButton.setEnabled(true);
                android.widget.Toast.makeText(SeatSelectionActivity.this, "Couldn't reach the server.", android.widget.Toast.LENGTH_LONG).show();
            }
        });
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }
}

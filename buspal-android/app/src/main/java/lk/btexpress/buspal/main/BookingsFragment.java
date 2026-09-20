package lk.btexpress.buspal.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.gson.Gson;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.FragmentBookingsBinding;
import lk.btexpress.buspal.model.Booking;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookingsFragment extends Fragment {

    private FragmentBookingsBinding binding;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        binding = FragmentBookingsBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        binding.bookingsRecycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        binding.swipeRefresh.setOnRefreshListener(this::loadBookings);
        loadBookings();
    }

    @Override
    public void onResume() {
        super.onResume();
        loadBookings(); // pick up anything just booked on the Book tab
    }

    private void loadBookings() {
        binding.loadingSpinner.setVisibility(View.VISIBLE);
        binding.emptyText.setVisibility(View.GONE);

        ApiClient.getService().getMyBookings().enqueue(new Callback<ApiResponse<List<Booking>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<Booking>>> call, Response<ApiResponse<List<Booking>>> response) {
                if (binding == null) return;
                binding.loadingSpinner.setVisibility(View.GONE);
                binding.swipeRefresh.setRefreshing(false);
                List<Booking> bookings = (response.isSuccessful() && response.body() != null && response.body().data != null)
                        ? response.body().data : new ArrayList<>();
                binding.emptyText.setVisibility(bookings.isEmpty() ? View.VISIBLE : View.GONE);
                binding.bookingsRecycler.setAdapter(new BookingAdapter(bookings, new BookingAdapter.Listener() {
                    @Override
                    public void onView(Booking booking) {
                        Intent intent = new Intent(requireContext(), BoardingPassActivity.class);
                        intent.putExtra(BoardingPassActivity.EXTRA_BOOKING, new Gson().toJson(booking));
                        startActivity(intent);
                    }

                    @Override
                    public void onCancel(Booking booking) {
                        confirmCancel(booking);
                    }
                }));
            }

            @Override
            public void onFailure(Call<ApiResponse<List<Booking>>> call, Throwable t) {
                if (binding == null) return;
                binding.loadingSpinner.setVisibility(View.GONE);
                binding.swipeRefresh.setRefreshing(false);
                binding.emptyText.setText("Couldn't reach the server. Pull down to retry.");
                binding.emptyText.setVisibility(View.VISIBLE);
            }
        });
    }

    private void confirmCancel(Booking booking) {
        new AlertDialog.Builder(requireContext())
                .setTitle("Cancel this booking?")
                .setMessage(booking.from + " → " + booking.to + " on " + booking.date + ". This can't be undone.")
                .setPositiveButton("Yes, cancel", (dialog, which) -> {
                    Map<String, Long> body = new HashMap<>();
                    body.put("id", booking.id);

                    ApiClient.getService().cancelBooking(body)
                            .enqueue(new Callback<ApiResponse<Booking>>() {
                        @Override
                        public void onResponse(Call<ApiResponse<Booking>> call, Response<ApiResponse<Booking>> response) {
                            loadBookings();
                        }
                        @Override
                        public void onFailure(Call<ApiResponse<Booking>> call, Throwable t) {
                            android.widget.Toast.makeText(requireContext(), "Couldn't cancel — try again.", android.widget.Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton("Keep booking", null)
                .show();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }
}

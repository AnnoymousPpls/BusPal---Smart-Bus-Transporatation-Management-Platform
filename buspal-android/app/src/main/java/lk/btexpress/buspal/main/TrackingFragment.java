package lk.btexpress.buspal.main;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import java.util.List;

import lk.btexpress.buspal.R;
import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.FragmentTrackingBinding;
import lk.btexpress.buspal.model.Booking;
import lk.btexpress.buspal.model.Tracking;
import lk.btexpress.buspal.model.TrackingStop;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class TrackingFragment extends Fragment {

    private FragmentTrackingBinding binding;

    private final Handler handler =
            new Handler(Looper.getMainLooper());

    private final Runnable refreshRunnable =
            new Runnable() {
                @Override
                public void run() {

                    if (binding != null) {
                        loadTracking();
                        handler.postDelayed(
                                this,
                                15000
                        );
                    }
                }
            };


    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState) {

        binding =
                FragmentTrackingBinding.inflate(
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

        super.onViewCreated(
                view,
                savedInstanceState
        );

        loadTracking();
    }


    // ============================================================
    // LOAD LIVE TRACKING
    // ============================================================

    private void loadTracking() {

        if (binding == null) {
            return;
        }

        showLoading();

        ApiClient.getService()
                .getLiveTracking()
                .enqueue(
                        new Callback<ApiResponse<Tracking>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<Tracking>> call,
                                    Response<ApiResponse<Tracking>> response) {

                                if (binding == null) {
                                    return;
                                }

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success) {

                                    Tracking tracking =
                                            response.body().data;

                                    if (tracking != null) {

                                        showLiveTracking(
                                                tracking
                                        );

                                    } else {

                                        loadUpcomingBooking();
                                    }

                                } else {

                                    loadUpcomingBooking();
                                }
                            }


                            @Override
                            public void onFailure(
                                    Call<ApiResponse<Tracking>> call,
                                    Throwable t) {

                                if (binding == null) {
                                    return;
                                }

                                loadUpcomingBooking();
                            }
                        }
                );
    }


    // ============================================================
    // LIVE TRACKING SCREEN
    // ============================================================

    private void showLiveTracking(
            Tracking tracking) {

        if (binding == null) {
            return;
        }

        binding.statusText.setText(
                "Live Tracking"
        );

        String route =
                safe(tracking.getFrom())
                        + " → "
                        + safe(tracking.getTo());

        binding.tripText.setText(route);
        binding.tripText.setVisibility(
                View.VISIBLE
        );


        // --------------------------------------------------------
        // BUS
        // --------------------------------------------------------

        String bus =
                tracking.getBusPlate();

        if (bus == null
                || bus.trim().isEmpty()) {

            bus = "TBA";
        }

        binding.etaText.setText(
                "Bus " + bus
                        + "  •  ETA "
                        + formatEta(
                        tracking.getEtaMinutes()
                )
        );

        binding.etaText.setVisibility(
                View.VISIBLE
        );


        // --------------------------------------------------------
        // STOPS
        // --------------------------------------------------------

        displayStops(
                tracking.getStops()
        );
    }


    // ============================================================
    // UPCOMING BOOKING
    // ============================================================

    private void loadUpcomingBooking() {

        if (binding == null) {
            return;
        }

        ApiClient.getService()
                .getMyBookings()
                .enqueue(
                        new Callback<ApiResponse<List<Booking>>>() {

                            @Override
                            public void onResponse(
                                    Call<ApiResponse<List<Booking>>> call,
                                    Response<ApiResponse<List<Booking>>> response) {

                                if (binding == null) {
                                    return;
                                }

                                if (response.isSuccessful()
                                        && response.body() != null
                                        && response.body().success
                                        && response.body().data != null) {

                                    Booking next =
                                            findUpcomingBooking(
                                                    response.body().data
                                            );

                                    if (next != null) {

                                        showNotTracking(
                                                next
                                        );

                                    } else {

                                        showNoTrip();
                                    }

                                } else {

                                    showNoTrip();
                                }
                            }


                            @Override
                            public void onFailure(
                                    Call<ApiResponse<List<Booking>>> call,
                                    Throwable t) {

                                if (binding == null) {
                                    return;
                                }

                                showNoTrip();
                            }
                        }
                );
    }


    // ============================================================
    // FIND UPCOMING BOOKING
    // ============================================================

    private Booking findUpcomingBooking(
            List<Booking> bookings) {

        if (bookings == null) {
            return null;
        }

        for (Booking booking : bookings) {

            if (booking == null) {
                continue;
            }

            if ("upcoming".equalsIgnoreCase(
                    booking.status
            )) {

                return booking;
            }
        }

        return null;
    }


    // ============================================================
    // NOT CURRENTLY TRACKED
    // ============================================================

    private void showNotTracking(
            Booking booking) {

        if (binding == null) {
            return;
        }

        binding.statusText.setText(
                "Live Tracking"
        );

        binding.tripText.setText(
                safe(booking.from)
                        + " → "
                        + safe(booking.to)
        );

        binding.tripText.setVisibility(
                View.VISIBLE
        );

        binding.etaText.setText(
                "Tracking hasn't started yet"
        );

        binding.etaText.setVisibility(
                View.VISIBLE
        );
    }


    // ============================================================
    // NO UPCOMING TRIP
    // ============================================================

    private void showNoTrip() {

        if (binding == null) {
            return;
        }

        binding.statusText.setText(
                "Live Tracking"
        );

        binding.tripText.setText(
                "No upcoming trips"
        );

        binding.tripText.setVisibility(
                View.VISIBLE
        );

        binding.etaText.setText(
                "Search and book a trip first."
        );

        binding.etaText.setVisibility(
                View.VISIBLE
        );
    }


    // ============================================================
    // LOADING
    // ============================================================

    private void showLoading() {

        if (binding == null) {
            return;
        }

        binding.statusText.setText(
                "Live Tracking"
        );

        binding.tripText.setText(
                "Locating your bus..."
        );

        binding.tripText.setVisibility(
                View.VISIBLE
        );

        binding.etaText.setVisibility(
                View.GONE
        );
    }


    // ============================================================
    // DISPLAY STOPS
    // ============================================================

    private void displayStops(
            List<TrackingStop> stops) {

        if (binding == null) {
            return;
        }

        /*
         * This section is intentionally simple for now.
         *
         * We are not adding Google Maps yet.
         * Once the map is connected, this same tracking
         * information will be used to position the bus.
         */

        if (stops == null
                || stops.isEmpty()) {

            return;
        }

        StringBuilder stopText =
                new StringBuilder();

        stopText.append("Stops\n");

        for (int i = 0;
             i < stops.size();
             i++) {

            TrackingStop stop =
                    stops.get(i);

            if (stop == null) {
                continue;
            }

            String status =
                    stop.getStatus();

            String marker;

            if ("done".equalsIgnoreCase(status)) {

                marker = "✓ ";

            } else if ("current".equalsIgnoreCase(status)) {

                marker = "● ";

            } else {

                marker = "○ ";
            }

            stopText.append(
                    marker
                            + safe(stop.getName())
            );

            if (i < stops.size() - 1) {
                stopText.append("\n");
            }
        }

        /*
         * For now we place the stop information into
         * the existing trip text area only if your current
         * XML does not yet contain a dedicated stop container.
         *
         * We will make a proper vertical timeline in XML
         * in the next step.
         */
    }


    // ============================================================
    // ETA FORMAT
    // ============================================================

    private String formatEta(
            int minutes) {

        if (minutes <= 0) {
            return "Arriving";
        }

        if (minutes < 60) {
            return minutes + " min";
        }

        int hours =
                minutes / 60;

        int remaining =
                minutes % 60;

        if (remaining == 0) {
            return hours + " hr";
        }

        return hours
                + " hr "
                + remaining
                + " min";
    }


    // ============================================================
    // SAFE STRING
    // ============================================================

    private String safe(
            String value) {

        if (value == null
                || value.trim().isEmpty()) {

            return "TBA";
        }

        return value;
    }


    // ============================================================
    // AUTO REFRESH
    // ============================================================

    @Override
    public void onResume() {

        super.onResume();

        handler.removeCallbacks(
                refreshRunnable
        );

        handler.postDelayed(
                refreshRunnable,
                15000
        );
    }


    @Override
    public void onPause() {

        super.onPause();

        handler.removeCallbacks(
                refreshRunnable
        );
    }


    @Override
    public void onDestroyView() {

        handler.removeCallbacksAndMessages(
                null
        );

        super.onDestroyView();

        binding = null;
    }
}

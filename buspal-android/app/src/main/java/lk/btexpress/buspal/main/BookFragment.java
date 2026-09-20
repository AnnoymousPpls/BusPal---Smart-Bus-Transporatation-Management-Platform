package lk.btexpress.buspal.main;

import android.app.DatePickerDialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

import lk.btexpress.buspal.api.ApiClient;
import lk.btexpress.buspal.api.ApiResponse;
import lk.btexpress.buspal.databinding.FragmentBookBinding;
import lk.btexpress.buspal.model.Departure;
import lk.btexpress.buspal.model.Route;
import lk.btexpress.buspal.model.Trip;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;


public class BookFragment extends Fragment {

    private FragmentBookBinding binding;
    private String selectedDate;


    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {

        binding = FragmentBookBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }


    @Override
    public void onViewCreated(@NonNull View view,
                              @Nullable Bundle savedInstanceState) {

        super.onViewCreated(view, savedInstanceState);


        binding.resultsRecycler.setLayoutManager(
                new LinearLayoutManager(requireContext())
        );


        Calendar cal = Calendar.getInstance();

        setDate(cal);


        binding.dateInput.setOnClickListener(v -> {

            DatePickerDialog picker =
                    new DatePickerDialog(
                            requireContext(),
                            (view1, year, month, day) -> {

                                Calendar picked = Calendar.getInstance();
                                picked.set(year, month, day);

                                setDate(picked);
                            },

                            cal.get(Calendar.YEAR),
                            cal.get(Calendar.MONTH),
                            cal.get(Calendar.DAY_OF_MONTH)
                    );

            picker.show();
        });


        binding.searchButton.setOnClickListener(v -> runSearch());

        runSearch();
    }



    private void setDate(Calendar cal) {

        selectedDate = String.format(
                Locale.US,
                "%04d-%02d-%02d",
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH)
        );


        binding.dateInput.setText(
                String.format(
                        Locale.US,
                        "%02d/%02d/%04d",
                        cal.get(Calendar.MONTH)+1,
                        cal.get(Calendar.DAY_OF_MONTH),
                        cal.get(Calendar.YEAR)
                )
        );
    }



    private void runSearch() {


        String from = textOf(binding.fromInput);
        String to = textOf(binding.toInput);


        binding.loadingSpinner.setVisibility(View.VISIBLE);
        binding.emptyText.setVisibility(View.GONE);



        ApiClient.getService()
                .getRoutes("public")
                .enqueue(new Callback<ApiResponse<List<Route>>>() {


                    @Override
                    public void onResponse(
                            Call<ApiResponse<List<Route>>> call,
                            Response<ApiResponse<List<Route>>> response) {


                        if(binding == null)
                            return;


                        binding.loadingSpinner.setVisibility(View.GONE);



                        List<Trip> trips = new ArrayList<>();



                        if(response.isSuccessful()
                                && response.body() != null
                                && response.body().data != null) {



                            for(Route route : response.body().data) {


                                if(route.from_city.equalsIgnoreCase(from)
                                        &&
                                        route.to_city.equalsIgnoreCase(to)) {



                                    if(route.departures != null) {


                                        for(Departure dep : route.departures) {


                                            Trip trip = new Trip();

                                            trip.departureId = dep.id;       // IMPORTANT
                                            trip.from = route.from_city;
                                            trip.to = route.to_city;
                                            trip.date = selectedDate;

                                            trip.depTime = dep.time;
                                            trip.plate = dep.bus_plate;

                                            trip.busType = "AC Luxury";
                                            trip.price = route.fare;

                                            trip.seatsTotal = 40;
                                            trip.seatsAvailable = 40;
                                            trip.seatsTaken = new ArrayList<>();

                                            trips.add(trip);
                                        }
                                    }
                                }
                            }
                        }



                        if(trips.isEmpty()) {

                            binding.emptyText.setText(
                                    "No buses match that search — try a different route or date."
                            );

                            binding.emptyText.setVisibility(View.VISIBLE);

                        }



                        binding.resultsRecycler.setAdapter(
                                new TripAdapter(
                                        trips,
                                        BookFragment.this::openSeatSelection
                                )
                        );

                    }



                    @Override
                    public void onFailure(
                            Call<ApiResponse<List<Route>>> call,
                            Throwable t) {


                        if(binding == null)
                            return;


                        binding.loadingSpinner.setVisibility(View.GONE);


                        binding.emptyText.setText(
                                "Couldn't reach the server. Check your connection."
                        );


                        binding.emptyText.setVisibility(View.VISIBLE);
                    }
                });
    }



    private void openSeatSelection(Trip trip) {


        android.content.Intent intent =
                new android.content.Intent(
                        requireContext(),
                        SeatSelectionActivity.class
                );


        intent.putExtra(
                SeatSelectionActivity.EXTRA_TRIP,
                new com.google.gson.Gson().toJson(trip)
        );


        startActivity(intent);
    }



    private String textOf(
            com.google.android.material.textfield.TextInputEditText input) {


        return input.getText() != null
                ? input.getText().toString().trim()
                : "";
    }



    @Override
    public void onDestroyView() {

        super.onDestroyView();

        binding = null;
    }
}
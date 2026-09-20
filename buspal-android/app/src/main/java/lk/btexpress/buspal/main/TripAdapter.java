package lk.btexpress.buspal.main;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

import lk.btexpress.buspal.databinding.ItemTripBinding;
import lk.btexpress.buspal.model.Trip;

public class TripAdapter extends RecyclerView.Adapter<TripAdapter.VH> {

    public interface OnSelectSeats { void onSelect(Trip trip); }

    private final List<Trip> trips;
    private final OnSelectSeats callback;

    public TripAdapter(List<Trip> trips, OnSelectSeats callback) {
        this.trips = trips;
        this.callback = callback;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemTripBinding binding = ItemTripBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull VH holder, int position) {
        Trip t = trips.get(position);
        holder.binding.routeText.setText(t.from + " → " + t.to);
        holder.binding.timeText.setText(t.depTime + " · " + t.busType + " · " + t.plate);
        holder.binding.priceText.setText("LKR " + NumberFormat.getNumberInstance(Locale.US).format(t.price));

        boolean soldOut = t.seatsAvailable <= 0;
        holder.binding.seatsText.setText(soldOut ? "Sold out" : t.seatsAvailable + " seats left");
        holder.binding.selectSeatsButton.setEnabled(!soldOut);
        holder.binding.selectSeatsButton.setText(soldOut ? "Sold out" : "Select seats");
        holder.binding.selectSeatsButton.setOnClickListener(v -> callback.onSelect(t));
    }

    @Override
    public int getItemCount() { return trips.size(); }

    static class VH extends RecyclerView.ViewHolder {
        final ItemTripBinding binding;
        VH(ItemTripBinding binding) { super(binding.getRoot()); this.binding = binding; }
    }
}

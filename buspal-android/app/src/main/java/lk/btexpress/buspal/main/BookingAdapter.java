package lk.btexpress.buspal.main;

import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

import lk.btexpress.buspal.R;
import lk.btexpress.buspal.databinding.ItemBookingBinding;
import lk.btexpress.buspal.model.Booking;

public class BookingAdapter extends RecyclerView.Adapter<BookingAdapter.VH> {

    public interface Listener {
        void onView(Booking booking);
        void onCancel(Booking booking);
    }

    private final List<Booking> bookings;
    private final Listener listener;

    public BookingAdapter(List<Booking> bookings, Listener listener) {
        this.bookings = bookings;
        this.listener = listener;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemBookingBinding binding = ItemBookingBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(binding);
    }

    @Override
    public void onBindViewHolder(@NonNull VH holder, int position) {
        Booking b = bookings.get(position);
        holder.binding.routeText.setText(b.from + " → " + b.to);
        holder.binding.detailsText.setText(b.date + " · " + b.depTime + " · Seats " + android.text.TextUtils.join(", ", b.seats) + " · " + b.pnr);
        holder.binding.statusText.setText(b.status.toUpperCase());

        int colorRes = "upcoming".equals(b.status) ? R.color.brand : "completed".equals(b.status) ? R.color.brand_2 : R.color.text_muted;
        holder.binding.statusText.setTextColor(ContextCompat.getColor(holder.itemView.getContext(), colorRes));

        boolean canCancel = "upcoming".equals(b.status);
        holder.binding.cancelButton.setVisibility(canCancel ? android.view.View.VISIBLE : android.view.View.GONE);
        holder.binding.cancelButton.setOnClickListener(v -> listener.onCancel(b));
        holder.binding.getRoot().setOnClickListener(v -> listener.onView(b));
    }

    @Override
    public int getItemCount() { return bookings.size(); }

    static class VH extends RecyclerView.ViewHolder {
        final ItemBookingBinding binding;
        VH(ItemBookingBinding binding) { super(binding.getRoot()); this.binding = binding; }
    }
}

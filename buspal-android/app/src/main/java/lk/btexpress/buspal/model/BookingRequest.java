package lk.btexpress.buspal.model;

import java.util.List;

public class BookingRequest {

    public long departureId;
    public String travelDate;
    public List<String> seats;


    public BookingRequest(long departureId, String travelDate, List<String> seats) {
        this.departureId = departureId;
        this.travelDate = travelDate;
        this.seats = seats;
    }
}
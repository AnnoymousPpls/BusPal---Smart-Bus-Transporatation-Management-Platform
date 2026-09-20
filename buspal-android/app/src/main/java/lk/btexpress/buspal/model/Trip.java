package lk.btexpress.buspal.model;

import java.util.List;

public class Trip {
    public long departureId;
    public String from;
    public String to;
    public String date;      // ISO yyyy-MM-dd
    public String depTime;   // "HH:mm"
    public String busType;
    public String plate;
    public long price;
    public int seatsTotal;
    public int seatsAvailable;
    public List<String> seatsTaken;
}

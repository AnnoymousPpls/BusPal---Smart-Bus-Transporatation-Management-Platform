package lk.btexpress.buspal.model;

import java.util.List;

public class Booking {
    public long id;
    public String pnr;
    public String from;
    public String to;
    public String date;
    public String depTime;
    public String busPlate;
    public String busType;
    public List<String> seats;
    public String status; // "upcoming" | "completed" | "cancelled"
}

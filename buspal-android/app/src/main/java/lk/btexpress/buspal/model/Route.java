package lk.btexpress.buspal.model;

import java.util.List;

public class Route {

    public int id;

    public String from_city;
    public String to_city;

    public int distance_km;
    public int fare;

    public boolean visible;

    public List<Departure> departures;
}
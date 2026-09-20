package lk.btexpress.buspal.model;

import java.util.List;

public class Tracking {

    private int id;

    private String from;
    private String to;
    private String date;
    private String depTime;

    private String busPlate;
    private String driverName;
    private String conductorName;

    private String status;

    private int currentStopIndex;
    private int etaMinutes;

    private boolean visible;

    private List<TrackingStop> stops;

    private String updatedAt;

    private int bookingId;
    private String bookingPnr;


    public Tracking() {
        // Required by Gson
    }


    public int getId() {
        return id;
    }

    public String getFrom() {
        return from;
    }

    public String getTo() {
        return to;
    }

    public String getDate() {
        return date;
    }

    public String getDepTime() {
        return depTime;
    }

    public String getBusPlate() {
        return busPlate;
    }

    public String getDriverName() {
        return driverName;
    }

    public String getConductorName() {
        return conductorName;
    }

    public String getStatus() {
        return status;
    }

    public int getCurrentStopIndex() {
        return currentStopIndex;
    }

    public int getEtaMinutes() {
        return etaMinutes;
    }

    public boolean isVisible() {
        return visible;
    }

    public List<TrackingStop> getStops() {
        return stops;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public int getBookingId() {
        return bookingId;
    }

    public String getBookingPnr() {
        return bookingPnr;
    }


    public void setId(int id) {
        this.id = id;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public void setDepTime(String depTime) {
        this.depTime = depTime;
    }

    public void setBusPlate(String busPlate) {
        this.busPlate = busPlate;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

    public void setConductorName(String conductorName) {
        this.conductorName = conductorName;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setCurrentStopIndex(int currentStopIndex) {
        this.currentStopIndex = currentStopIndex;
    }

    public void setEtaMinutes(int etaMinutes) {
        this.etaMinutes = etaMinutes;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    public void setStops(List<TrackingStop> stops) {
        this.stops = stops;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public void setBookingId(int bookingId) {
        this.bookingId = bookingId;
    }

    public void setBookingPnr(String bookingPnr) {
        this.bookingPnr = bookingPnr;
    }
}
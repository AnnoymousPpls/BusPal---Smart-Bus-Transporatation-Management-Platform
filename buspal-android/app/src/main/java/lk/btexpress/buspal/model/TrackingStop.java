package lk.btexpress.buspal.model;

public class TrackingStop {

    private String name;
    private String status;

    public TrackingStop() {
        // Required by Gson
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
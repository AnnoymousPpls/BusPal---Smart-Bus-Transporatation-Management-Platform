package lk.btexpress.buspal.model;

public class AuthResponse {
    public String token;
    public long accountId;
    public String name;
    public String email;
    public String role; // "PASSENGER" | "OWNER" | "MANAGER"
}

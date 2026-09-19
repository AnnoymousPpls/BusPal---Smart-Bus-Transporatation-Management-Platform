package lk.btexpress.buspal.api;

/** Mirrors lk.btexpress.buspal.common.ApiResponse<T> on the backend exactly — {success, data, message, timestamp}. */
public class ApiResponse<T> {
    public boolean success;
    public T data;
    public String message;
    public String timestamp;
}

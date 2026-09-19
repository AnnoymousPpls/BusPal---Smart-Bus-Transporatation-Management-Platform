package lk.btexpress.buspal.api;

import java.util.List;
import java.util.Map;

import lk.btexpress.buspal.model.AuthResponse;
import lk.btexpress.buspal.model.Booking;
import lk.btexpress.buspal.model.BookingRequest;
import lk.btexpress.buspal.model.ChangePasswordRequest;
import lk.btexpress.buspal.model.EmergencyContact;
import lk.btexpress.buspal.model.FeedbackRequest;
import lk.btexpress.buspal.model.FeedbackResponse;
import lk.btexpress.buspal.model.LoginRequest;
import lk.btexpress.buspal.model.RegisterRequest;
import lk.btexpress.buspal.model.Route;
import lk.btexpress.buspal.model.SosRequest;
import lk.btexpress.buspal.model.Tracking;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.Query;

public interface ApiService {

    // =========================
    // AUTH
    // =========================

    @POST("auth/login.php")
    Call<ApiResponse<AuthResponse>> login(
            @Body LoginRequest req
    );

    @POST("auth/register.php")
    Call<ApiResponse<AuthResponse>> register(
            @Body RegisterRequest req
    );


    // =========================
    // PASSWORD
    // =========================

    @POST("auth/change-password.php")
    Call<ApiResponse<Void>> changePassword(
            @Body ChangePasswordRequest request
    );


    // =========================
    // ROUTES
    // =========================

    @GET("routes")
    Call<ApiResponse<List<Route>>> getRoutes(
            @Query("scope") String scope
    );


    // =========================
    // BOOKINGS
    // =========================

    @GET("bookings/index.php")
    Call<ApiResponse<List<Booking>>> getMyBookings();

    @POST("bookings/index.php")
    Call<ApiResponse<Booking>> createBooking(
            @Body BookingRequest req
    );

    @PATCH("bookings/index.php")
    Call<ApiResponse<Booking>> cancelBooking(
            @Body Map<String, Long> body
    );


    // =========================
    // FEEDBACK
    // =========================

    @POST("feedback/index.php")
    Call<ApiResponse<FeedbackResponse>> submitFeedback(
            @Body FeedbackRequest req
    );


    // =========================
    // SOS
    // =========================

    @POST("sos/index.php")
    Call<ApiResponse<Void>> triggerSos(
            @Body SosRequest req
    );


    // =========================
    // EMERGENCY CONTACTS
    // =========================



    @GET("contacts/index.php")
    Call<ApiResponse<List<EmergencyContact>>> getEmergencyContacts();

    @POST("contacts/index.php")
    Call<ApiResponse<EmergencyContact>> addEmergencyContact(
            @Body EmergencyContact contact
    );

    @DELETE("contacts/index.php")
    Call<ApiResponse<EmergencyContact>> deleteEmergencyContact(
            @Query("id") long id
    );

    // =========================
// LIVE TRACKING
// =========================

    @GET("tracking/index.php")
    Call<ApiResponse<Tracking>> getLiveTracking();
}
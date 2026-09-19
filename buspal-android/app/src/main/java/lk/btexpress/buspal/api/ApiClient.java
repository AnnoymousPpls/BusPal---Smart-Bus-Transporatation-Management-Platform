package lk.btexpress.buspal.api;

import android.content.Context;
import java.io.IOException;
import lk.btexpress.buspal.BuildConfig;
import lk.btexpress.buspal.util.SessionManager;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {

    private static ApiService service;

    /** Call once (e.g. from Application.onCreate or the first Activity) before using getService(). */
    public static void init(Context context) {
        if (service != null) return;

        SessionManager session = new SessionManager(context);

        Interceptor authInterceptor = chain -> {
            Request original = chain.request();
            String token = session.getToken();
            if (token == null) return chain.proceed(original);
            Request authed = original.newBuilder()
                    .header("Authorization", "Bearer " + token)
                    .build();
            return chain.proceed(authed);
        };

        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(BuildConfig.DEBUG ? HttpLoggingInterceptor.Level.BODY : HttpLoggingInterceptor.Level.NONE);

        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(logging)
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BuildConfig.API_BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        service = retrofit.create(ApiService.class);
    }

    public static ApiService getService() {
        if (service == null) {
            throw new IllegalStateException("ApiClient.init(context) must be called before getService().");
        }
        return service;
    }

    /** Best-effort human-readable message out of a failed Retrofit response body (still an ApiResponse envelope, usually). */
    public static String extractError(retrofit2.Response<?> response) {
        try {
            if (response.errorBody() != null) {
                String body = response.errorBody().string();
                return body != null && !body.isEmpty() ? body : "Something went wrong (" + response.code() + ").";
            }
        } catch (IOException ignored) { }
        return "Something went wrong (" + response.code() + ").";
    }
}

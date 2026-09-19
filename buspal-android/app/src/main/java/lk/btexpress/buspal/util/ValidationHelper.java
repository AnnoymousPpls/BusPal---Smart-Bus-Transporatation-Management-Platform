package lk.btexpress.buspal.util;

import java.util.regex.Pattern;

/** Same rules as shared/js/validate.js on the website — kept in sync deliberately. */
public class ValidationHelper {

    private static final Pattern PHONE = Pattern.compile("^(?:\\+94|0)7\\d{8}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public static boolean isValidPhone(String v) {
        if (v == null) return false;
        return PHONE.matcher(v.replace(" ", "").replace("-", "")).matches();
    }

    public static boolean isValidEmail(String v) {
        if (v == null) return false;
        return EMAIL.matcher(v.trim()).matches();
    }

    public static String passwordStrengthLabel(String pw) {
        if (pw == null) pw = "";
        if (pw.length() < 6) return "Too short";
        int score = 0;
        if (pw.length() >= 8) score++;
        if (pw.length() >= 12) score++;
        if (pw.matches(".*[a-z].*") && pw.matches(".*[A-Z].*")) score++;
        if (pw.matches(".*\\d.*")) score++;
        if (pw.matches(".*[^A-Za-z0-9].*")) score++;
        if (score <= 1) return "Weak";
        if (score == 2) return "Fair";
        if (score == 3) return "Good";
        return "Strong";
    }

    public static boolean isWeakPassword(String pw) {
        String label = passwordStrengthLabel(pw);
        return label.equals("Too short") || label.equals("Weak");
    }
}

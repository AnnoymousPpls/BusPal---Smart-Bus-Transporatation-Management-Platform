package lk.btexpress.buspal.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Direct port of shared/js/seatLayout.js — same algorithm, same output,
 * so a 37-seat bus lays out identically here as it does on the website
 * and in the operator/conductor tools. See that file's header comment
 * for the reasoning (matches BT Express's real paper seat chart).
 */
public class SeatLayoutHelper {

    public static class SeatRow {
        public final String type; // "pair" or "bench"
        public final List<Integer> seats;
        SeatRow(String type, List<Integer> seats) { this.type = type; this.seats = seats; }
    }

    public static List<SeatRow> generate(int capacity) {
        if (capacity < 1) capacity = 40;

        int backRowSize = 0;
        int fullRows = 0;
        int[] candidates = {5, 3, 7, 1, 2, 4, 6};
        for (int c : candidates) {
            if (capacity > c && (capacity - c) % 4 == 0) {
                backRowSize = c;
                fullRows = (capacity - c) / 4;
                break;
            }
        }
        if (fullRows == 0 && backRowSize == 0) {
            fullRows = capacity / 4;
            backRowSize = capacity - fullRows * 4;
        }

        List<SeatRow> rows = new ArrayList<>();
        int n = 1;
        for (int r = 0; r < fullRows; r++) {
            List<Integer> seats = new ArrayList<>();
            for (int i = 0; i < 4; i++) seats.add(n++);
            rows.add(new SeatRow("pair", seats));
        }
        if (backRowSize > 0) {
            List<Integer> seats = new ArrayList<>();
            for (int i = 0; i < backRowSize; i++) seats.add(n++);
            rows.add(new SeatRow("bench", seats));
        }
        return rows;
    }
}

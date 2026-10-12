/* ==========================================================================
   BusPal — Operator Dashboard — Bookings Analysis Report
   ==========================================================================

   Complete replacement version

   Features:
   - Premium BusPal blue PDF design
   - Real BusPal logo
   - Logo embedded into PDF
   - Preview PDF before download
   - Page numbers
   - Booking summary cards
   - Booking status analysis
   - Booking source analysis
   - Route booking line graph
   - Route revenue analysis
   - Detailed booking tables
   - Upcoming / Completed / Cancelled sections
   - LKR currency formatting
   - Correct booking date handling
   - Clean route formatting
   - Multi-page PDF

   Dependencies:
   - jsPDF
   - jsPDF-AutoTable

   ========================================================================== */

(() => {

    "use strict";


    /* ======================================================================
       CONFIGURATION
    ====================================================================== */

    const LOGO_PATH =
        "../shared/assets/logo.png";


    /* ======================================================================
       PREMIUM COLOUR PALETTE
    ====================================================================== */

    const BLUE =
        [38, 103, 230];

    const DARK_BLUE =
        [20, 55, 105];

    const TEXT =
        [30, 41, 59];

    const MUTED =
        [100, 116, 139];

    const LIGHT_BLUE =
        [239, 246, 255];

    const BORDER =
        [203, 213, 225];

    const WHITE =
        [255, 255, 255];

    const LIGHT_GREY =
        [248, 250, 252];

    const GREEN =
        [22, 163, 74];

    const GREEN_LIGHT =
        [240, 253, 244];

    const GREY =
        [107, 114, 128];

    const GREY_LIGHT =
        [243, 244, 246];

    const AMBER =
        [146, 64, 14];

    const AMBER_LIGHT =
        [254, 243, 199];


    /* ======================================================================
       BASIC HELPERS
    ====================================================================== */

    function safeNumber(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    function safeString(
        value,
        fallback = ""
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return fallback;
        }

        const text =
            String(value).trim();

        return text || fallback;
    }


    function showReportToast(message) {

        if (
            typeof toast === "function"
        ) {

            toast(message);

            return;
        }


        if (
            typeof showToast === "function"
        ) {

            showToast(message);

            return;
        }

        console.warn(message);
    }


    /* ======================================================================
       DATE HELPERS
    ====================================================================== */

    function getTodayLocalDate() {

        const now =
            new Date();

        const year =
            now.getFullYear();

        const month =
            String(
                now.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                now.getDate()
            ).padStart(
                2,
                "0"
            );

        return (
            `${year}-${month}-${day}`
        );
    }


    function normaliseBookingDate(
        value
    ) {

        if (!value) {

            return "";
        }


        const text =
            String(value).trim();


        /* YYYY-MM-DD */

        const isoMatch =
            text.match(
                /^(\d{4})-(\d{2})-(\d{2})/
            );


        if (isoMatch) {

            return (
                `${isoMatch[1]}-` +
                `${isoMatch[2]}-` +
                `${isoMatch[3]}`
            );
        }


        /* DD/MM/YYYY */

        const slashMatch =
            text.match(
                /^(\d{2})\/(\d{2})\/(\d{4})$/
            );


        if (slashMatch) {

            return (
                `${slashMatch[3]}-` +
                `${slashMatch[2]}-` +
                `${slashMatch[1]}`
            );
        }


        /* DD-MM-YYYY */

        const dashMatch =
            text.match(
                /^(\d{2})-(\d{2})-(\d{4})$/
            );


        if (dashMatch) {

            return (
                `${dashMatch[3]}-` +
                `${dashMatch[2]}-` +
                `${dashMatch[1]}`
            );
        }


        return "";
    }


    function formatDate(
        dateString
    ) {

        const date =
            normaliseBookingDate(
                dateString
            );


        if (!date) {

            return safeString(
                dateString,
                "—"
            );
        }


        const parts =
            date.split("-");


        return (
            `${parts[2]}/` +
            `${parts[1]}/` +
            `${parts[0]}`
        );
    }


    function formatLongDate(
        dateString
    ) {

        const date =
            normaliseBookingDate(
                dateString
            );


        if (!date) {

            return "—";
        }


        const parsed =
            new Date(
                `${date}T00:00:00`
            );


        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {

            return formatDate(
                date
            );
        }


        return parsed.toLocaleDateString(
            "en-LK",
            {
                day:
                    "numeric",

                month:
                    "long",

                year:
                    "numeric"
            }
        );
    }


    function getReportGeneratedAt() {

        return new Intl.DateTimeFormat(
            "en-LK",
            {
                timeZone:
                    "Asia/Colombo",

                day:
                    "numeric",

                month:
                    "long",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hour12:
                    true
            }
        ).format(
            new Date()
        );
    }


    /* ======================================================================
       BOOKING STATUS
    ====================================================================== */

    function getEffectiveBookingStatus(
        booking
    ) {

        const status =
            String(
                booking?.status || ""
            ).toLowerCase().trim();


        /*
         * Explicit cancelled bookings remain cancelled.
         */

        if (
            status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        /*
         * Explicit completed bookings remain completed.
         */

        if (
            status ===
            "completed"
        ) {

            return "completed";
        }


        const bookingDate =
            normaliseBookingDate(
                booking?.date
            );


        /*
         * If the date cannot be read,
         * preserve the server status.
         */

        if (!bookingDate) {

            return (
                status ||
                "upcoming"
            );
        }


        const today =
            getTodayLocalDate();


        /*
         * Past travel dates are completed.
         */

        if (
            bookingDate <
            today
        ) {

            return "completed";
        }


        /*
         * Today and future dates are upcoming.
         */

        return "upcoming";
    }


    function prepareBookings(
        bookings
    ) {

        return bookings.map(
            booking => ({

                ...booking,

                effectiveStatus:
                    getEffectiveBookingStatus(
                        booking
                    ),

                normalisedDate:
                    normaliseBookingDate(
                        booking.date
                    )

            })
        );
    }


    /* ======================================================================
       BOOKING DATA HELPERS
    ====================================================================== */

    function getBookingSeats(
        booking
    ) {

        if (
            Array.isArray(
                booking?.seats
            )
        ) {

            return booking.seats;
        }


        return [];
    }


    function getBookingSeatCount(
        booking
    ) {

        return getBookingSeats(
            booking
        ).length;
    }


    function getBookingPrice(
        booking
    ) {

        return safeNumber(
            booking?.price
        );
    }


    function getBookingTotal(
        booking
    ) {

        return (
            getBookingPrice(
                booking
            ) *
            getBookingSeatCount(
                booking
            )
        );
    }


    function getBookingSource(
        booking
    ) {

        return String(
            booking?.source ||
            "self"
        ).toLowerCase().trim();
    }


    function isCounterBooking(
        booking
    ) {

        return (
            getBookingSource(
                booking
            ) === "counter"
        );
    }


    function getPassengerName(
        booking
    ) {

        return safeString(
            booking?.passengerName ||
            booking?.passenger ||
            booking?.name,
            "Unknown Passenger"
        );
    }


    function getPassengerPhone(
        booking
    ) {

        return safeString(
            booking?.phone ||
            booking?.passengerPhone,
            "No phone"
        );
    }


    /* ======================================================================
       ROUTE HELPERS
    ====================================================================== */

    function cleanEndpoint(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }


        let text =
            String(value).trim();


        /*
         * Remove exclamation marks
         * at beginning/end.
         */

        text =
            text.replace(
                /^!+\s*/,
                ""
            );


        text =
            text.replace(
                /\s*!+\s*$/,
                ""
            );


        /*
         * Convert internal !
         * separators into hyphens.
         */

        text =
            text.replace(
                /\s*!\s*/g,
                " - "
            );


        /*
         * Remove duplicate hyphens.
         */

        text =
            text.replace(
                /\s*-\s*-\s*/g,
                " - "
            );


        /*
         * Normalize spaces.
         */

        text =
            text.replace(
                /\s+/g,
                " "
            );


        return text.trim();
    }


    function getRouteFrom(
        booking
    ) {

        return cleanEndpoint(
            booking?.from ??
            booking?.from_city ??
            booking?.origin ??
            ""
        );
    }


    function getRouteTo(
        booking
    ) {

        return cleanEndpoint(
            booking?.to ??
            booking?.to_city ??
            booking?.destination ??
            ""
        );
    }


    function getRouteName(
        booking
    ) {

        const from =
            getRouteFrom(
                booking
            );

        const to =
            getRouteTo(
                booking
            );


        if (
            from &&
            to
        ) {

            return (
                `${from} - ${to}`
            );
        }


        if (from) {

            return from;
        }


        if (to) {

            return to;
        }


        const fallback =
            booking?.route ??
            booking?.routeName ??
            booking?.route_name ??
            booking?.name ??
            "";


        if (fallback) {

            return cleanEndpoint(
                fallback
            );
        }


        return "Unknown Route";
    }


    /* ======================================================================
       FORMATTERS
    ====================================================================== */

    function money(
        value
    ) {

        return (
            `LKR ${safeNumber(value)
                .toLocaleString(
                    "en-LK"
                )}`
        );
    }


    function number(
        value
    ) {

        return safeNumber(
            value
        ).toLocaleString(
            "en-LK"
        );
    }


    function getDepartureTime(
        booking
    ) {

        const value =
            booking?.depTime ??
            booking?.departureTime ??
            booking?.departure_time ??
            booking?.time ??
            "";


        if (!value) {

            return "—";
        }


        return String(
            value
        ).slice(
            0,
            5
        );
    }


    /* ======================================================================
       LOGO
    ====================================================================== */

    function getLogoURL() {

        return new URL(
            LOGO_PATH,
            document.baseURI
        ).href;
    }


    async function imageToDataURL(
        url
    ) {

        const response =
            await fetch(
                url
            );


        if (!response.ok) {

            throw new Error(
                `BusPal logo could not be loaded (${response.status}).`
            );
        }


        const blob =
            await response.blob();


        return await new Promise(
            (
                resolve,
                reject
            ) => {

                const reader =
                    new FileReader();


                reader.onloadend =
                    () => {

                        resolve(
                            reader.result
                        );
                    };


                reader.onerror =
                    () => {

                        reject(
                            new Error(
                                "Unable to convert BusPal logo."
                            )
                        );
                    };


                reader.readAsDataURL(
                    blob
                );
            }
        );
    }


    async function loadLogo() {

        try {

            return await imageToDataURL(
                getLogoURL()
            );

        } catch (error) {

            console.warn(
                "BusPal logo loading failed:",
                error
            );

            return null;
        }
    }


    /* ======================================================================
       PDF HELPERS
    ====================================================================== */

    function getPDF() {

        if (
            typeof window.jspdf ===
            "undefined"
        ) {

            throw new Error(
                "jsPDF is not loaded."
            );
        }


        const JsPDF =
            window.jspdf.jsPDF;


        return new JsPDF(
            {
                orientation:
                    "portrait",

                unit:
                    "mm",

                format:
                    "a4"
            }
        );
    }


    function getPageWidth(
        doc
    ) {

        return doc.internal.pageSize.getWidth();
    }


    function getPageHeight(
        doc
    ) {

        return doc.internal.pageSize.getHeight();
    }


    /*
     * Start a new content page without repeating the report header.
     * The full BusPal report header is intentionally shown only on page 1.
     */

    function startNewContentPage(
        doc
    ) {

        doc.addPage();

        return 18;
    }


    /* ======================================================================
       PAGE HEADER
    ====================================================================== */

    function drawPageHeader(
        doc,
        logoData,
        reportDate,
        generatedAt
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );


        const left =
            20;

        const right =
            20;


        /*
         * Thin top accent.
         */

        doc.setFillColor(
            ...BLUE
        );

        doc.rect(
            0,
            0,
            pageWidth,
            3,
            "F"
        );


        /*
         * Logo.
         */

        if (logoData) {

            try {

                doc.addImage(
                    logoData,
                    "PNG",
                    left,
                    9,
                    16,
                    16,
                    undefined,
                    "FAST"
                );

            } catch (error) {

                console.warn(
                    "Unable to draw BusPal logo:",
                    error
                );
            }
        }


        /*
         * Brand.
         */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            18
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            "BusPal",
            left + 21,
            16
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            7.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "Smart Bus Transportation Platform",
            left + 21,
            21
        );


        /*
         * Report date box.
         */

        const boxWidth =
            67;

        const boxHeight =
            21;

        const boxX =
            pageWidth -
            right -
            boxWidth;

        const boxY =
            8;


        doc.setFillColor(
            ...LIGHT_BLUE
        );

        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.35
        );

        doc.roundedRect(
            boxX,
            boxY,
            boxWidth,
            boxHeight,
            3,
            3,
            "FD"
        );


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            6.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "REPORT DATE",
            boxX + 5,
            boxY + 6
        );


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            9
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            reportDate,
            boxX + 5,
            boxY + 12
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            5.8
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            `Generated: ${generatedAt}`,
            boxX + 5,
            boxY + 17
        );


        /*
         * Report title.
         */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            17
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            "Bookings Analysis Report",
            left,
            39
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            8
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "Passenger reservations, booking sources and route activity.",
            left,
            45
        );


        /*
         * Divider.
         */

        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.45
        );

        doc.line(
            left,
            49,
            pageWidth - right,
            49
        );


        return 57;
    }


    /* ======================================================================
       PAGE FOOTER
    ====================================================================== */

    function drawPageFooter(
        doc,
        pageNumber,
        pageCount
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );

        const pageHeight =
            getPageHeight(
                doc
            );


        const left =
            20;

        const right =
            20;


        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.3
        );

        doc.line(
            left,
            pageHeight - 18,
            pageWidth - right,
            pageHeight - 18
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            7.5
        );

        doc.setTextColor(
            ...MUTED
        );


        doc.text(
            "BusPal • Bookings Analysis",
            left,
            pageHeight - 9
        );


        doc.text(
            `Page ${pageNumber} of ${pageCount}`,
            pageWidth - right,
            pageHeight - 9,
            {
                align:
                    "right"
            }
        );
    }


    /* ======================================================================
       SECTION TITLE
    ====================================================================== */

    function drawSectionTitle(
        doc,
        title,
        subtitle,
        y
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );


        const left =
            20;

        const right =
            20;


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            12
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            title,
            left,
            y
        );


        if (subtitle) {

            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(
                7.5
            );

            doc.setTextColor(
                ...MUTED
            );

            doc.text(
                subtitle,
                left,
                y + 6
            );
        }


        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.3
        );

        doc.line(
            left,
            y + 10,
            pageWidth - right,
            y + 10
        );


        return y + 16;
    }


    /* ======================================================================
       SUMMARY CARD
    ====================================================================== */

    function drawSummaryCard(
        doc,
        x,
        y,
        width,
        height,
        value,
        label,
        description,
        accent = BLUE
    ) {

        doc.setFillColor(
            ...WHITE
        );

        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.4
        );

        doc.roundedRect(
            x,
            y,
            width,
            height,
            3,
            3,
            "FD"
        );


        /*
         * Accent strip.
         */

        doc.setFillColor(
            ...accent
        );

        doc.roundedRect(
            x,
            y,
            2.2,
            height,
            1,
            1,
            "F"
        );


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            16
        );

        doc.setTextColor(
            ...accent
        );

        doc.text(
            String(value),
            x + 7,
            y + 11
        );


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            7.2
        );

        doc.setTextColor(
            ...TEXT
        );

        doc.text(
            label,
            x + 7,
            y + 17
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            5.8
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            description,
            x + 7,
            y + 22
        );
    }


    /* ======================================================================
       LINE GRAPH
    ====================================================================== */

    function drawLineGraph(
        doc,
        routeStats,
        startY
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );


        const left =
            20;

        const right =
            20;


        const chartWidth =
            pageWidth -
            left -
            right;


        /*
         * Section heading.
         */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            12
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            "Operational Analysis",
            left,
            startY
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            7.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "Booking distribution across available routes.",
            left,
            startY + 7
        );


        /*
         * Chart container.
         */

        const containerTop =
            startY + 14;

        /*
         * Compact card sized to match the other report cards while
         * leaving enough room for the title, graph and route labels.
         */
        const containerHeight =
            68;

        const containerBottom =
            containerTop +
            containerHeight;


        doc.setFillColor(
            ...WHITE
        );

        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.5
        );

        doc.roundedRect(
            left,
            containerTop,
            chartWidth,
            containerHeight,
            4,
            4,
            "FD"
        );


        /*
         * Chart title.
         *
         * Align the heading with the actual plotting area so the
         * title, subtitle, graph and route labels form one clean
         * vertical alignment line.
         */

        const contentLeft =
            left + 6;

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            9
        );

        doc.setTextColor(
            ...TEXT
        );

        doc.text(
            "Bookings by Route",
            contentLeft,
            containerTop + 12
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            6.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "Number of booking records for each available route.",
            contentLeft,
            containerTop + 18
        );


        /*
         * Plot area.
         */

        const graphLeft =
            contentLeft;

        const graphRight =
            left +
            chartWidth -
            8;

        /*
         * Leave a dedicated label area inside the card.
         * This keeps the route names aligned with their points
         * without touching the page footer.
         */
        const graphTop =
            containerTop + 23;

        const graphBottom =
            containerBottom - 21;

        const graphWidth =
            graphRight -
            graphLeft;

        const graphHeight =
            graphBottom -
            graphTop;


        /*
         * Data.
         */

        const counts =
            routeStats.map(
                item =>
                    safeNumber(
                        item.bookings
                    )
            );


        const maxCount =
            Math.max(
                ...counts,
                1
            );


        /*
         * Grid lines.
         */

        const gridLines =
            4;


        for (
            let i = 0;
            i <= gridLines;
            i++
        ) {

            const value =
                maxCount -
                (
                    maxCount /
                    gridLines
                ) *
                i;


            const y =
                graphTop +
                (
                    graphHeight /
                    gridLines
                ) *
                i;


            doc.setDrawColor(
                226,
                232,
                240
            );

            doc.setLineWidth(
                0.2
            );

            doc.line(
                graphLeft,
                y,
                graphRight,
                y
            );


            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(
                5.8
            );

            doc.setTextColor(
                ...MUTED
            );

            doc.text(
                String(
                    Math.round(
                        value
                    )
                ),
                graphLeft - 4,
                y + 2,
                {
                    align:
                        "right"
                }
            );
        }


        /*
         * Axis.
         */

        doc.setDrawColor(
            148,
            163,
            184
        );

        doc.setLineWidth(
            0.35
        );

        doc.line(
            graphLeft,
            graphTop,
            graphLeft,
            graphBottom
        );

        doc.line(
            graphLeft,
            graphBottom,
            graphRight,
            graphBottom
        );


        /*
         * No data.
         */

        if (
            !routeStats.length
        ) {

            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(
                8
            );

            doc.setTextColor(
                ...MUTED
            );

            doc.text(
                "No route booking data available.",
                graphLeft +
                    graphWidth / 2,
                graphTop +
                    graphHeight / 2,
                {
                    align:
                        "center"
                }
            );


            return (
                containerBottom +
                6
            );
        }


        /*
         * Points.
         */

        const pointSpacing =
            routeStats.length === 1
                ? 0
                : graphWidth /
                  (
                      routeStats.length -
                      1
                  );


        const points =
            [];


        routeStats.forEach(
            (
                item,
                index
            ) => {

                const count =
                    safeNumber(
                        item.bookings
                    );


                const x =
                    routeStats.length === 1

                        ? graphLeft +
                          graphWidth / 2

                        : graphLeft +
                          index *
                          pointSpacing;


                const y =
                    graphBottom -
                    (
                        count /
                        maxCount
                    ) *
                    graphHeight;


                points.push({
                    x,
                    y,
                    count
                });
            }
        );


        /*
         * Line.
         */

        doc.setDrawColor(
            ...BLUE
        );

        doc.setLineWidth(
            0.9
        );


        for (
            let i = 0;
            i <
            points.length - 1;
            i++
        ) {

            doc.line(
                points[i].x,
                points[i].y,
                points[i + 1].x,
                points[i + 1].y
            );
        }


        /*
         * Points + values.
         */

        points.forEach(
            point => {

                doc.setFillColor(
                    ...WHITE
                );

                doc.setDrawColor(
                    ...BLUE
                );

                doc.setLineWidth(
                    0.8
                );

                doc.circle(
                    point.x,
                    point.y,
                    1.8,
                    "FD"
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    6
                );

                doc.setTextColor(
                    ...BLUE
                );

                doc.text(
                    String(
                        point.count
                    ),
                    point.x,
                    point.y - 3.5,
                    {
                        align:
                            "center"
                    }
                );
            }
        );


        /*
         * X-axis labels.
         *
         * Two-line labels prevent
         * the graph from becoming messy.
         */

        routeStats.forEach(
            (
                item,
                index
            ) => {

                const point =
                    points[index];


                const route =
                    item.label;


                const parts =
                    route.split(
                        " - "
                    );


                const from =
                    parts[0] ||
                    route;


                const to =
                    parts.slice(
                        1
                    ).join(
                        " - "
                    );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    5.1
                );

                doc.setTextColor(
                    ...MUTED
                );


                /*
                 * Keep both parts of every route directly under
                 * the corresponding graph point.
                 */
                doc.text(
                    from,
                    point.x,
                    graphBottom + 4,
                    {
                        align:
                            "center"
                    }
                );


                if (to) {

                    doc.text(
                        `- ${to}`,
                        point.x,
                        graphBottom + 8.5,
                        {
                            align:
                                "center"
                    }
                    );
                }
            }
        );


        /*
         * Axis labels.
         *
         * The numeric scale on the left already identifies the
         * measure, so no extra y-axis title is drawn here. This
         * avoids colliding with the chart subtitle. The route
         * names below each point identify the horizontal axis.
         */


        /*
         * Keep the next section safely separated from the footer.
         */
        return (
            containerBottom +
            5
        );
    }


    /* ======================================================================
       DISTRIBUTION BAR
    ====================================================================== */

    function drawDistributionBars(
        doc,
        title,
        subtitle,
        items,
        startY,
        accent = BLUE
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );


        const left =
            20;

        const right =
            20;


        const width =
            pageWidth -
            left -
            right;


        const height =
            67;


        doc.setFillColor(
            ...WHITE
        );

        doc.setDrawColor(
            ...BORDER
        );

        doc.setLineWidth(
            0.45
        );

        doc.roundedRect(
            left,
            startY,
            width,
            height,
            4,
            4,
            "FD"
        );


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            9
        );

        doc.setTextColor(
            ...TEXT
        );

        doc.text(
            title,
            left + 8,
            startY + 13
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            6.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            subtitle,
            left + 8,
            startY + 19
        );


        const maxValue =
            Math.max(
                ...items.map(
                    item =>
                        safeNumber(
                            item.value
                        )
                ),
                1
            );


        let y =
            startY + 30;


        items.forEach(
            item => {

                const value =
                    safeNumber(
                        item.value
                    );


                const percentage =
                    (
                        value /
                        maxValue
                    );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    6.5
                );

                doc.setTextColor(
                    ...TEXT
                );

                doc.text(
                    item.label,
                    left + 8,
                    y + 2
                );


                const barX =
                    left + 57;

                const barWidth =
                    width - 87;


                doc.setFillColor(
                    241,
                    245,
                    249
                );

                doc.roundedRect(
                    barX,
                    y - 2,
                    barWidth,
                    5,
                    2,
                    2,
                    "F"
                );


                if (
                    value > 0
                ) {

                    doc.setFillColor(
                        ...accent
                    );

                    doc.roundedRect(
                        barX,
                        y - 2,
                        Math.max(
                            2,
                            barWidth *
                            percentage
                        ),
                        5,
                        2,
                        2,
                        "F"
                    );
                }


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    6.5
                );

                doc.setTextColor(
                    ...TEXT
                );

                doc.text(
                    number(value),
                    left +
                        width -
                        8,
                    y + 2,
                    {
                        align:
                            "right"
                    }
                );


                y += 12;
            }
        );


        return (
            startY +
            height +
            8
        );
    }


    /* ======================================================================
       ROUTE TABLE
    ====================================================================== */

    function drawRouteTable(
        doc,
        routeStats,
        startY
    ) {

        const autoTable =
            doc.autoTable;


        if (
            typeof autoTable !==
            "function"
        ) {

            throw new Error(
                "jsPDF AutoTable is not loaded."
            );
        }


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            12
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            "Route Booking Summary",
            20,
            startY
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            7.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            "Booking volume, seats and recorded value by route.",
            20,
            startY + 7
        );


        autoTable.call(
            doc,
            {
                startY:
                    startY + 12,

                margin:
                    {
                        left:
                            20,

                        right:
                            20
                    },

                head:
                    [[
                        "Route",
                        "Bookings",
                        "Seats",
                        "Booking Value"
                    ]],

                body:
                    routeStats.map(
                        item => [

                            item.label,

                            number(
                                item.bookings
                            ),

                            number(
                                item.seats
                            ),

                            money(
                                item.revenue
                            )

                        ]
                    ),

                theme:
                    "grid",

                styles:
                    {
                        font:
                            "helvetica",

                        fontSize:
                            7,

                        cellPadding:
                            3,

                        textColor:
                            TEXT,

                        lineColor:
                            BORDER,

                        lineWidth:
                            0.25,

                        valign:
                            "middle"
                    },

                headStyles:
                    {
                        fillColor:
                            DARK_BLUE,

                        textColor:
                            WHITE,

                        fontStyle:
                            "bold",

                        fontSize:
                            6.5
                    },

                alternateRowStyles:
                    {
                        fillColor:
                            LIGHT_GREY
                    },

                columnStyles:
                    {
                        0:
                            {
                                cellWidth:
                                    85
                            },

                        1:
                            {
                                halign:
                                    "center",

                                cellWidth:
                                    28
                            },

                        2:
                            {
                                halign:
                                    "center",

                                cellWidth:
                                    24
                            },

                        3:
                            {
                                halign:
                                    "right",

                                cellWidth:
                                    42
                            }
                    },

                didDrawPage:
                    data => {

                        data.cursor;
                    }
            }
        );


        return (
            doc.lastAutoTable.finalY +
            10
        );
    }


    /* ======================================================================
       BOOKING TABLE
    ====================================================================== */

    function drawBookingTable(
        doc,
        title,
        subtitle,
        bookings,
        startY
    ) {

        const autoTable =
            doc.autoTable;


        if (
            typeof autoTable !==
            "function"
        ) {

            throw new Error(
                "jsPDF AutoTable is not loaded."
            );
        }


        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            12
        );

        doc.setTextColor(
            ...DARK_BLUE
        );

        doc.text(
            title,
            20,
            startY
        );


        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            7.5
        );

        doc.setTextColor(
            ...MUTED
        );

        doc.text(
            subtitle,
            20,
            startY + 7
        );


        if (
            !bookings.length
        ) {

            doc.setFillColor(
                ...LIGHT_GREY
            );

            doc.setDrawColor(
                ...BORDER
            );

            doc.roundedRect(
                20,
                startY + 12,
                getPageWidth(doc) - 40,
                17,
                3,
                3,
                "FD"
            );


            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(
                7
            );

            doc.setTextColor(
                ...MUTED
            );

            doc.text(
                "No booking records available.",
                getPageWidth(doc) / 2,
                startY + 22,
                {
                    align:
                        "center"
                }
            );


            return (
                startY +
                36
            );
        }


        autoTable.call(
            doc,
            {
                startY:
                    startY + 12,

                margin:
                    {
                        left:
                            10,

                        right:
                            10,

                        bottom:
                            22
                    },

                head:
                    [[
                        "Passenger",
                        "Route",
                        "Date & Time",
                        "Seats",
                        "Fare",
                        "Source",
                        "Status"
                    ]],

                body:
                    bookings.map(
                        booking => {

                            const seats =
                                getBookingSeats(
                                    booking
                                );


                            const seatText =
                                seats.length
                                    ? seats.join(
                                        ", "
                                    )
                                    : "—";


                            const source =
                                isCounterBooking(
                                    booking
                                )
                                    ? "COUNTER"
                                    : "SELF";


                            return [

                                getPassengerName(
                                    booking
                                ) +
                                "\n" +
                                getPassengerPhone(
                                    booking
                                ),

                                getRouteName(
                                    booking
                                ),

                                formatDate(
                                    booking.date
                                ) +
                                "\n" +
                                getDepartureTime(
                                    booking
                                ),

                                seatText +
                                "\n" +
                                seats.length +
                                (
                                    seats.length === 1
                                        ? " seat"
                                        : " seats"
                                ),

                                money(
                                    getBookingTotal(
                                        booking
                                    )
                                ) +
                                "\n" +
                                money(
                                    getBookingPrice(
                                        booking
                                    )
                                ) +
                                " / seat",

                                source,

                                String(
                                    booking.effectiveStatus ||
                                    "upcoming"
                                ).toUpperCase()

                            ];
                        }
                    ),

                theme:
                    "grid",

                styles:
                    {
                        font:
                            "helvetica",

                        fontSize:
                            6.3,

                        cellPadding:
                            2.6,

                        textColor:
                            TEXT,

                        lineColor:
                            BORDER,

                        lineWidth:
                            0.22,

                        valign:
                            "middle",

                        overflow:
                            "linebreak"
                    },

                headStyles:
                    {
                        fillColor:
                            DARK_BLUE,

                        textColor:
                            WHITE,

                        fontStyle:
                            "bold",

                        fontSize:
                            5.8,

                        halign:
                            "left"
                    },

                alternateRowStyles:
                    {
                        fillColor:
                            LIGHT_GREY
                    },

                columnStyles:
                    {
                        0:
                            {
                                cellWidth:
                                    31
                            },

                        1:
                            {
                                cellWidth:
                                    36
                            },

                        2:
                            {
                                cellWidth:
                                    28
                            },

                        3:
                            {
                                cellWidth:
                                    24
                            },

                        4:
                            {
                                cellWidth:
                                    29
                            },

                        5:
                            {
                                cellWidth:
                                    20,

                                halign:
                                    "center"
                            },

                        6:
                            {
                                cellWidth:
                                    22,

                                halign:
                                    "center"
                            }
                    },

                didParseCell:
                    data => {

                        if (
                            data.section !==
                            "body"
                        ) {

                            return;
                        }


                        /*
                         * Status styling.
                         */

                        if (
                            data.column.index ===
                            6
                        ) {

                            const status =
                                String(
                                    data.cell.raw
                                ).toLowerCase();


                            if (
                                status ===
                                "upcoming"
                            ) {

                                data.cell.styles.textColor =
                                    BLUE;

                            } else if (
                                status ===
                                "completed"
                            ) {

                                data.cell.styles.textColor =
                                    GREEN;

                            } else if (
                                status ===
                                "cancelled"
                            ) {

                                data.cell.styles.textColor =
                                    GREY;
                            }


                            data.cell.styles.fontStyle =
                                "bold";
                        }


                        /*
                         * Source styling.
                         */

                        if (
                            data.column.index ===
                            5
                        ) {

                            const source =
                                String(
                                    data.cell.raw
                                ).toLowerCase();


                            if (
                                source ===
                                "counter"
                            ) {

                                data.cell.styles.textColor =
                                    AMBER;

                            } else {

                                data.cell.styles.textColor =
                                    MUTED;
                            }


                            data.cell.styles.fontStyle =
                                "bold";
                        }
                    }
            }
        );


        return (
            doc.lastAutoTable.finalY +
            10
        );
    }


    /* ======================================================================
       METRIC BLOCK
    ====================================================================== */

    function drawMetricGrid(
        doc,
        metrics,
        startY
    ) {

        const pageWidth =
            getPageWidth(
                doc
            );


        const left =
            20;

        const gap =
            5;

        const columns =
            4;

        const cardWidth =
            (
                pageWidth -
                40 -
                (
                    gap *
                    (
                        columns -
                        1
                    )
                )
            ) /
            columns;


        const cardHeight =
            23;


        metrics.forEach(
            (
                metric,
                index
            ) => {

                const row =
                    Math.floor(
                        index /
                        columns
                    );

                const column =
                    index %
                    columns;


                const x =
                    left +
                    column *
                    (
                        cardWidth +
                        gap
                    );


                const y =
                    startY +
                    row *
                    (
                        cardHeight +
                        gap
                    );


                doc.setFillColor(
                    ...WHITE
                );

                doc.setDrawColor(
                    ...BORDER
                );

                doc.setLineWidth(
                    0.35
                );

                doc.roundedRect(
                    x,
                    y,
                    cardWidth,
                    cardHeight,
                    3,
                    3,
                    "FD"
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    10
                );

                doc.setTextColor(
                    ...(metric.accent ||
                    TEXT)
                );

                doc.text(
                    String(
                        metric.value
                    ),
                    x + 6,
                    y + 10
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    5.7
                );

                doc.setTextColor(
                    ...MUTED
                );

                doc.text(
                    metric.label,
                    x + 6,
                    y + 17
                );
            }
        );


        return (
            startY +
            (
                Math.ceil(
                    metrics.length /
                    columns
                ) *
                (
                    cardHeight +
                    gap
                )
            )
        );
    }


    /* ======================================================================
       MAIN REPORT FUNCTION
    ====================================================================== */

    window.downloadBookingsReport =
        async function (
            bookings
        ) {

            try {

                /*
                 * Validation.
                 */

                if (
                    !Array.isArray(
                        bookings
                    )
                ) {

                    showReportToast(
                        "No booking data available for the report."
                    );

                    return;
                }


                /*
                 * Prepare data.
                 */

                const reportBookings =
                    prepareBookings(
                        bookings
                    );


                /*
                 * Status groups.
                 */

                const upcomingBookings =
                    reportBookings.filter(
                        booking =>
                            booking.effectiveStatus ===
                            "upcoming"
                    );


                const completedBookings =
                    reportBookings.filter(
                        booking =>
                            booking.effectiveStatus ===
                            "completed"
                    );


                const cancelledBookings =
                    reportBookings.filter(
                        booking =>
                            booking.effectiveStatus ===
                            "cancelled"
                    );


                /*
                 * Basic statistics.
                 */

                const totalBookings =
                    reportBookings.length;

                const upcomingCount =
                    upcomingBookings.length;

                const completedCount =
                    completedBookings.length;

                const cancelledCount =
                    cancelledBookings.length;


                /*
                 * Seat statistics.
                 */

                const totalSeats =
                    reportBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingSeatCount(
                                booking
                            ),
                        0
                    );


                const upcomingSeats =
                    upcomingBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingSeatCount(
                                booking
                            ),
                        0
                    );


                const completedSeats =
                    completedBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingSeatCount(
                                booking
                            ),
                        0
                    );


                const cancelledSeats =
                    cancelledBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingSeatCount(
                                booking
                            ),
                        0
                    );


                /*
                 * Revenue.
                 */

                const totalRevenue =
                    reportBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingTotal(
                                booking
                            ),
                        0
                    );


                const upcomingRevenue =
                    upcomingBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingTotal(
                                booking
                            ),
                        0
                    );


                const completedRevenue =
                    completedBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingTotal(
                                booking
                            ),
                        0
                    );


                const cancelledRevenue =
                    cancelledBookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            getBookingTotal(
                                booking
                            ),
                        0
                    );


                /*
                 * Source statistics.
                 */

                const selfBookings =
                    reportBookings.filter(
                        booking =>
                            !isCounterBooking(
                                booking
                            )
                    );


                const counterBookings =
                    reportBookings.filter(
                        booking =>
                            isCounterBooking(
                                booking
                            )
                    );


                /*
                 * Route statistics.
                 */

                const routeMap =
                    {};


                reportBookings.forEach(
                    booking => {

                        const route =
                            getRouteName(
                                booking
                            );


                        if (
                            !routeMap[route]
                        ) {

                            routeMap[route] =
                                {

                                    label:
                                        route,

                                    bookings:
                                        0,

                                    seats:
                                        0,

                                    revenue:
                                        0
                                };
                        }


                        routeMap[route]
                            .bookings += 1;


                        routeMap[route]
                            .seats +=
                            getBookingSeatCount(
                                booking
                            );


                        routeMap[route]
                            .revenue +=
                            getBookingTotal(
                                booking
                            );
                    }
                );


                const routeStats =
                    Object.values(
                        routeMap
                    ).sort(
                        (
                            a,
                            b
                        ) =>
                            b.bookings -
                            a.bookings
                    );


                /*
                 * Metrics.
                 */

                const averageBookingValue =
                    totalBookings
                        ? Math.round(
                            totalRevenue /
                            totalBookings
                        )
                        : 0;


                const cancellationRate =
                    totalBookings
                        ? Math.round(
                            (
                                cancelledCount /
                                totalBookings
                            ) *
                            100
                        )
                        : 0;


                const completionRate =
                    totalBookings
                        ? Math.round(
                            (
                                completedCount /
                                totalBookings
                            ) *
                            100
                        )
                        : 0;


                const averageSeatsPerBooking =
                    totalBookings
                        ? (
                            totalSeats /
                            totalBookings
                        ).toFixed(
                            1
                        )
                        : "0.0";


                /*
                 * Dates.
                 */

                const reportDate =
                    formatLongDate(
                        getTodayLocalDate()
                    );


                const generatedAt =
                    getReportGeneratedAt();


                /*
                 * Load logo.
                 */

                const logoData =
                    await loadLogo();


                /*
                 * Create PDF.
                 */

                const doc =
                    getPDF();


                /*
                 * Page 1 header.
                 */

                let y =
                    drawPageHeader(
                        doc,
                        logoData,
                        reportDate,
                        generatedAt
                    );


                /*
                 * Daily Summary.
                 */

                y =
                    drawSectionTitle(
                        doc,
                        "Daily Summary",
                        "Key statistics from the available booking records.",
                        y
                    );


                const pageWidth =
                    getPageWidth(
                        doc
                    );


                const cardGap =
                    5;

                const cardWidth =
                    (
                        pageWidth -
                        40 -
                        (
                            cardGap *
                            3
                        )
                    ) /
                    4;

                const cardHeight =
                    24;


                /*
                 * First row.
                 */

                drawSummaryCard(
                    doc,
                    20,
                    y,
                    cardWidth,
                    cardHeight,
                    number(
                        totalBookings
                    ),
                    "Total Bookings",
                    "All booking records",
                    BLUE
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ),
                    y,
                    cardWidth,
                    cardHeight,
                    number(
                        upcomingCount
                    ),
                    "Upcoming",
                    "Active future bookings",
                    BLUE
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ) *
                        2,
                    y,
                    cardWidth,
                    cardHeight,
                    number(
                        completedCount
                    ),
                    "Completed",
                    "Past travel records",
                    GREEN
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ) *
                        3,
                    y,
                    cardWidth,
                    cardHeight,
                    number(
                        cancelledCount
                    ),
                    "Cancelled",
                    "Cancelled records",
                    GREY
                );


                y +=
                    cardHeight +
                    5;


                /*
                 * Second row.
                 */

                drawSummaryCard(
                    doc,
                    20,
                    y,
                    cardWidth,
                    cardHeight,
                    number(
                        totalSeats
                    ),
                    "Seats Booked",
                    "Seats represented",
                    BLUE
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ),
                    y,
                    cardWidth,
                    cardHeight,
                    money(
                        totalRevenue
                    ),
                    "Booking Value",
                    "Recorded total value",
                    DARK_BLUE
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ) *
                        2,
                    y,
                    cardWidth,
                    cardHeight,
                    money(
                        averageBookingValue
                    ),
                    "Average Value",
                    "Per booking record",
                    BLUE
                );


                drawSummaryCard(
                    doc,
                    20 +
                        (
                            cardWidth +
                            cardGap
                        ) *
                        3,
                    y,
                    cardWidth,
                    cardHeight,
                    `${cancellationRate}%`,
                    "Cancellation Rate",
                    "Of all booking records",
                    GREY
                );


                y +=
                    cardHeight +
                    8;


                /*
                 * Booking status summary.
                 */

                y =
                    drawSectionTitle(
                        doc,
                        "Booking Status Summary",
                        "Current distribution of upcoming, completed and cancelled bookings.",
                        y
                    );


                const statusWidth =
                    (
                        pageWidth -
                        40 -
                        10
                    ) /
                    3;

                const statusHeight =
                    25;


                const statusCards =
                    [

                        {
                            title:
                                "Upcoming Bookings",

                            count:
                                upcomingCount,

                            seats:
                                upcomingSeats,

                            revenue:
                                upcomingRevenue,

                            accent:
                                BLUE
                        },

                        {
                            title:
                                "Completed Bookings",

                            count:
                                completedCount,

                            seats:
                                completedSeats,

                            revenue:
                                completedRevenue,

                            accent:
                                GREEN
                        },

                        {
                            title:
                                "Cancelled Bookings",

                            count:
                                cancelledCount,

                            seats:
                                cancelledSeats,

                            revenue:
                                cancelledRevenue,

                            accent:
                                GREY
                        }

                    ];


                statusCards.forEach(
                    (
                        card,
                        index
                    ) => {

                        const x =
                            20 +
                            index *
                            (
                                statusWidth +
                                5
                            );


                        doc.setFillColor(
                            ...WHITE
                        );

                        doc.setDrawColor(
                            ...BORDER
                        );

                        doc.setLineWidth(
                            0.4
                        );

                        doc.roundedRect(
                            x,
                            y,
                            statusWidth,
                            statusHeight,
                            3,
                            3,
                            "FD"
                        );


                        doc.setFont(
                            "helvetica",
                            "bold"
                        );

                        doc.setFontSize(
                            8
                        );

                        doc.setTextColor(
                            ...TEXT
                        );

                        doc.text(
                            card.title,
                            x + 6,
                            y + 8
                        );


                        doc.setFont(
                            "helvetica",
                            "bold"
                        );

                        doc.setFontSize(
                            15
                        );

                        doc.setTextColor(
                            ...card.accent
                        );

                        doc.text(
                            number(
                                card.count
                            ),
                            x + 6,
                            y + 18
                        );


                        doc.setFont(
                            "helvetica",
                            "normal"
                        );

                        doc.setFontSize(
                            5.7
                        );

                        doc.setTextColor(
                            ...MUTED
                        );

                        doc.text(
                            `${number(card.seats)} seats`,
                            x + 29,
                            y + 17
                        );

                        doc.text(
                            money(card.revenue),
                            x + 29,
                            y + 22
                        );
                    }
                );


                y +=
                    statusHeight +
                    4;


                /*
                 * Route line graph.
                 *
                 * Keep the graph on page 1 and use the available space
                 * below the booking status summary. The graph is compact
                 * enough to stay clear of the footer.
                 */

                y =
                    drawLineGraph(
                        doc,
                        routeStats,
                        y
                    );


                /*
                 * Source and status distribution.
                 */

                if (
                    y >
                    225
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawSectionTitle(
                        doc,
                        "Booking Distribution",
                        "Comparison of booking status and booking source.",
                        y
                    );


                /*
                 * Status bars.
                 */

                const statusBarItems =
                    [

                        {
                            label:
                                "Upcoming",

                            value:
                                upcomingCount
                        },

                        {
                            label:
                                "Completed",

                            value:
                                completedCount
                        },

                        {
                            label:
                                "Cancelled",

                            value:
                                cancelledCount
                        }

                    ];


                y =
                    drawDistributionBars(
                        doc,
                        "Booking Status",
                        "Number of records grouped by effective booking status.",
                        statusBarItems,
                        y,
                        BLUE
                    );


                /*
                 * Source bars.
                 */

                const sourceBarItems =
                    [

                        {
                            label:
                                "Self-booked",

                            value:
                                selfBookings.length
                        },

                        {
                            label:
                                "Counter-booked",

                            value:
                                counterBookings.length
                        }

                    ];


                y =
                    drawDistributionBars(
                        doc,
                        "Booking Source",
                        "Passenger self-bookings compared with operator counter bookings.",
                        sourceBarItems,
                        y,
                        DARK_BLUE
                    );


                /*
                 * Route table.
                 */

                if (
                    y >
                    220
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawSectionTitle(
                        doc,
                        "Route Analysis",
                        "Booking volume, seats and recorded booking value by route.",
                        y
                    );


                y =
                    drawRouteTable(
                        doc,
                        routeStats,
                        y
                    );


                /*
                 * Metrics.
                 */

                if (
                    y >
                    230
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawSectionTitle(
                        doc,
                        "Booking Metrics",
                        "Additional calculated indicators from the booking records.",
                        y
                    );


                const metrics =
                    [

                        {
                            value:
                                number(
                                    totalSeats
                                ),

                            label:
                                "Total Seats Booked",

                            accent:
                                BLUE
                        },

                        {
                            value:
                                money(
                                    totalRevenue
                                ),

                            label:
                                "Total Booking Value",

                            accent:
                                DARK_BLUE
                        },

                        {
                            value:
                                money(
                                    averageBookingValue
                                ),

                            label:
                                "Average Booking Value",

                            accent:
                                BLUE
                        },

                        {
                            value:
                                `${cancellationRate}%`,

                            label:
                                "Cancellation Rate",

                            accent:
                                GREY
                        },

                        {
                            value:
                                `${completionRate}%`,

                            label:
                                "Completion Rate",

                            accent:
                                GREEN
                        },

                        {
                            value:
                                averageSeatsPerBooking,

                            label:
                                "Average Seats / Booking",

                            accent:
                                BLUE
                        },

                        {
                            value:
                                number(
                                    selfBookings.length
                                ),

                            label:
                                "Self Bookings",

                            accent:
                                DARK_BLUE
                        },

                        {
                            value:
                                number(
                                    counterBookings.length
                                ),

                            label:
                                "Counter Bookings",

                            accent:
                                AMBER
                        }

                    ];


                y =
                    drawMetricGrid(
                        doc,
                        metrics,
                        y
                    );


                /*
                 * Booking details.
                 */

                if (
                    y >
                    205
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawBookingTable(
                        doc,
                        "Upcoming Bookings",
                        "Active future passenger reservations.",
                        upcomingBookings,
                        y
                    );


                /*
                 * Completed bookings.
                 */

                if (
                    y >
                    225
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawBookingTable(
                        doc,
                        "Completed Bookings",
                        "Bookings whose travel date has passed or was explicitly completed.",
                        completedBookings,
                        y
                    );


                /*
                 * Cancelled bookings.
                 */

                if (
                    y >
                    225
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawBookingTable(
                        doc,
                        "Cancelled Bookings",
                        "Booking records that were explicitly cancelled.",
                        cancelledBookings,
                        y
                    );


                /*
                 * Final analysis note.
                 */

                if (
                    y >
                    230
                ) {

                    y = startNewContentPage(
                        doc
                    );
                }


                y =
                    drawSectionTitle(
                        doc,
                        "Report Analysis",
                        "Summary of the booking dataset.",
                        y
                    );


                const noteHeight =
                    47;


                doc.setFillColor(
                    ...LIGHT_BLUE
                );

                doc.setDrawColor(
                    ...BORDER
                );

                doc.roundedRect(
                    20,
                    y,
                    pageWidth - 40,
                    noteHeight,
                    4,
                    4,
                    "FD"
                );


                doc.setFillColor(
                    ...BLUE
                );

                doc.roundedRect(
                    20,
                    y,
                    2.5,
                    noteHeight,
                    1,
                    1,
                    "F"
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    8
                );

                doc.setTextColor(
                    ...DARK_BLUE
                );

                doc.text(
                    "Booking Overview",
                    28,
                    y + 10
                );


                const analysisText =
                    [
                        `This report contains ${number(totalBookings)} booking record(s).`,

                        `There are ${number(upcomingCount)} upcoming booking(s), ${number(completedCount)} completed booking(s), and ${number(cancelledCount)} cancelled booking(s).`,

                        `A total of ${number(totalSeats)} seat(s) are represented across the booking records, with a recorded booking value of ${money(totalRevenue)}.`,

                        `Self-bookings account for ${number(selfBookings.length)} record(s), while counter bookings account for ${number(counterBookings.length)} record(s).`,

                        `The booking records cover ${number(routeStats.length)} route(s), with an average of ${averageSeatsPerBooking} seat(s) per booking.`

                    ];


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    6.7
                );

                doc.setTextColor(
                    ...TEXT
                );


                let textY =
                    y + 17;


                analysisText.forEach(
                    text => {

                        const lines =
                            doc.splitTextToSize(
                                text,
                                pageWidth - 58
                            );


                        doc.text(
                            lines,
                            28,
                            textY
                        );


                        textY +=
                            (
                                lines.length *
                                3.8
                            ) +
                            2;
                    }
                );


                /*
                 * Add page numbers to all pages.
                 */

                const pageCount =
                    doc.getNumberOfPages();


                for (
                    let page = 1;
                    page <= pageCount;
                    page++
                ) {

                    doc.setPage(
                        page
                    );


                    drawPageFooter(
                        doc,
                        page,
                        pageCount
                    );
                }


                /*
                 * Create blob URL.
                 */

                const pdfBlob =
                    doc.output(
                        "blob"
                    );


                const pdfURL =
                    URL.createObjectURL(
                        pdfBlob
                    );


                /*
                 * Open preview.
                 */

                const previewWindow =
                    window.open(
                        "",
                        "_blank",
                        "width=1200,height=900"
                    );


                if (
                    !previewWindow
                ) {

                    URL.revokeObjectURL(
                        pdfURL
                    );


                    showReportToast(
                        "Please allow pop-ups to preview the report."
                    );

                    return;
                }


                previewWindow.document.open();


                previewWindow.document.write(
                    `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
    BusPal Bookings Analysis Report
</title>

<style>

html,
body {

    margin:
        0;

    padding:
        0;

    width:
        100%;

    height:
        100%;

    overflow:
        hidden;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        #111827;
}


.toolbar {

    height:
        52px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    padding:
        0 16px;

    background:
        #ffffff;

    border-bottom:
        1px solid
        #d1d5db;

}


.toolbar-left {

    font-size:
        14px;

    font-weight:
        700;

    color:
        #1e3a8a;
}


.toolbar-right {

    display:
        flex;

    gap:
        8px;
}


button {

    border:
        none;

    border-radius:
        6px;

    padding:
        8px 14px;

    cursor:
        pointer;

    font-weight:
        600;

    font-size:
        12px;
}


.download {

    background:
        #2563eb;

    color:
        #ffffff;
}


.close {

    background:
        #f3f4f6;

    color:
        #111827;
}


iframe {

    width:
        100%;

    height:
        calc(100% - 53px);

    border:
        none;

    background:
        #374151;
}

</style>

</head>


<body>

<div class="toolbar">

    <div class="toolbar-left">
        BusPal • Bookings Analysis Report
    </div>


    <div class="toolbar-right">

        <button
            class="download"
            onclick="downloadPDF()"
        >
            Download PDF
        </button>


        <button
            class="close"
            onclick="window.close()"
        >
            Close
        </button>

    </div>

</div>


<iframe
    id="pdfFrame"
></iframe>


<script>

const pdfURL =
    ${JSON.stringify(pdfURL)};


document.getElementById(
    "pdfFrame"
).src =
    pdfURL;


function downloadPDF() {

    const anchor =
        document.createElement(
            "a"
        );

    anchor.href =
        pdfURL;

    anchor.download =
        "BusPal_Bookings_Analysis_Report.pdf";

    document.body.appendChild(
        anchor
    );

    anchor.click();

    anchor.remove();
}

</script>

</body>

</html>

                    `
                );


                previewWindow.document.close();


                /*
                 * Cleanup URL after the
                 * preview window closes.
                 */

                const cleanup =
                    () => {

                        try {

                            URL.revokeObjectURL(
                                pdfURL
                            );

                        } catch (
                            error
                        ) {

                            console.warn(
                                error
                            );
                        }
                    };


                previewWindow.addEventListener(
                    "beforeunload",
                    cleanup
                );


                previewWindow.focus();


            } catch (
                error
            ) {

                console.error(
                    "Bookings report generation failed:",
                    error
                );


                showReportToast(
                    "Unable to generate bookings report."
                );
            }
        };


    /* ======================================================================
       BACKWARD COMPATIBILITY
    ====================================================================== */

    /*
     * Some existing dashboard code may use the singular function name.
     * Keep it working without changing the dashboard.
     */

    window.downloadBookingReport =
        window.downloadBookingsReport;


})();
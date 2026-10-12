/*
|--------------------------------------------------------------------------
| BusPal — Routes & Schedules Report
|--------------------------------------------------------------------------
|
| Complete replacement version
|
| Features:
| - Premium blue report design
| - Real BusPal logo
| - Logo embedded directly into PDF
| - Preview PDF before download
| - Line graph
| - Daily summary
| - Departure details table
| - Selected date
| - Correct route formatting
| - Header only on first page
| - Page numbers
| - Clean "-" route separator
| - Compact aligned graph
|
|--------------------------------------------------------------------------
*/

(() => {

    "use strict";


    /* ======================================================================
       CONFIGURATION
    ====================================================================== */

    const LOGO_PATH =
        "../shared/assets/logo.png";


    /* ----------------------------------------------------------------------
       Premium blue colour palette
       ---------------------------------------------------------------------- */

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


    function routeFrom(route) {

        return (
            route?.from ??
            route?.from_city ??
            route?.origin ??
            ""
        );
    }


    function routeTo(route) {

        return (
            route?.to ??
            route?.to_city ??
            route?.destination ??
            ""
        );
    }


    function routeDepartures(route) {

        return Array.isArray(
            route?.departures
        )
            ? route.departures
            : [];
    }


    function money(value) {

        return (
            `LKR ${safeNumber(value).toLocaleString("en-LK")}`
        );
    }


    function formatDate(dateString) {

        if (!dateString) {
            return "";
        }

        const parts =
            String(dateString).split("-");

        if (parts.length !== 3) {
            return dateString;
        }

        return (
            `${parts[2]}/${parts[1]}/${parts[0]}`
        );
    }


    function formatLongDate(dateString) {

        if (!dateString) {
            return "";
        }

        const date =
            new Date(
                `${dateString}T00:00:00`
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return formatDate(dateString);
        }

        return date.toLocaleDateString(
            "en-LK",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
    }


    /* ======================================================================
       ROUTE CLEANING
       
       This specifically fixes:
       
       Akkaraipattu ! Jaffna
       Colombo ! Kandy
       
       into:
       
       Akkaraipattu - Jaffna
       Colombo - Kandy
    ====================================================================== */

    function cleanEndpoint(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        let text =
            String(value).trim();


        /*
         * Remove exclamation marks at the
         * beginning or end of a city name.
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
         * If an exclamation mark is actually
         * being used as a separator inside the
         * value, convert it to a hyphen.
         */

        text =
            text.replace(
                /\s*!\s*/g,
                " - "
            );


        /*
         * Remove duplicate hyphens/spaces.
         */

        text =
            text.replace(
                /\s*-\s*-\s*/g,
                " - "
            );


        text =
            text.replace(
                /\s+/g,
                " "
            );


        return text.trim();
    }


    function cleanRouteName(route) {

        let from =
            cleanEndpoint(
                routeFrom(route)
            );

        let to =
            cleanEndpoint(
                routeTo(route)
            );


        /*
         * If normal FROM / TO fields exist,
         * use them.
         */

        if (from && to) {

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


        /*
         * Fallback for data structures where
         * the complete route is stored as:
         *
         * "Colombo ! Kandy"
         */

        const possibleRoute =
            route?.route ??
            route?.routeName ??
            route?.route_name ??
            route?.name ??
            "";


        if (possibleRoute) {

            return cleanEndpoint(
                possibleRoute
            );
        }


        return "Unknown Route";
    }


    function cleanValue(
        value,
        fallback = "Not assigned"
    ) {

        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return fallback;
        }

        return String(value).trim();
    }


    function getDepartureTime(
        departure
    ) {

        const value =
            departure?.time ??
            departure?.departureTime ??
            departure?.departure_time ??
            "";


        if (!value) {
            return "—";
        }


        return String(value).slice(
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


    async function imageToDataURL(url) {

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `BusPal logo could not be loaded (${response.status}).`
            );
        }


        const blob =
            await response.blob();


        return await new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onloadend = () => {

                    resolve(
                        reader.result
                    );
                };


                reader.onerror = () => {

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

            const url =
                getLogoURL();


            return await imageToDataURL(
                url
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
       PAGE HELPERS
    ====================================================================== */

    function getPageWidth(doc) {

        return doc.internal.pageSize.getWidth();
    }


    function getPageHeight(doc) {

        return doc.internal.pageSize.getHeight();
    }


    function drawPageFooter(
        doc,
        pageNumber,
        pageCount
    ) {

        const pageWidth =
            getPageWidth(doc);

        const pageHeight =
            getPageHeight(doc);


        const left = 20;
        const right = 20;


        /* Footer line */

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


        /* Footer text */

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
            "BusPal • Routes & Schedules",
            left,
            pageHeight - 9
        );


        doc.text(
            `Page ${pageNumber} of ${pageCount}`,
            pageWidth - right,
            pageHeight - 9,
            {
                align: "right"
            }
        );
    }


    /* ======================================================================
       LINE GRAPH
    ====================================================================== */

    function drawLineGraph(
        doc,
        routes,
        startY
    ) {

        const pageWidth =
            getPageWidth(doc);


        const left = 20;
        const right = 20;


        const chartWidth =
            pageWidth -
            left -
            right;


        /* ------------------------------------------------------------------
           Container
           ------------------------------------------------------------------ */

        const containerTop =
            startY + 12;


        /*
         * Slightly smaller than before.
         */

        const containerHeight =
            92;


        const containerBottom =
            containerTop +
            containerHeight;


        /* ------------------------------------------------------------------
           Section heading
           ------------------------------------------------------------------ */

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
            "Departure distribution across available routes.",
            left,
            startY + 7
        );


        /* ------------------------------------------------------------------
           Graph container
           ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           Graph title
           ------------------------------------------------------------------ */

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
            "Departures by Route",
            left + 8,
            containerTop + 16
        );


        /* ------------------------------------------------------------------
           DATA
           ------------------------------------------------------------------ */

        const counts =
            routes.map(
                route =>
                    routeDepartures(route).length
            );


        const maxCount =
            Math.max(
                ...counts,
                1
            );


        /* ------------------------------------------------------------------
           PLOT AREA
           
           The graph is intentionally positioned
           LOWER inside the container.
           ------------------------------------------------------------------ */

        const graphLeft =
            left + 13;


        const graphRight =
            left +
            chartWidth -
            7;


        /*
         * Increased from the previous position.
         * This moves the graph down.
         */

        const graphTop =
            containerTop + 25;


        /*
         * More space reserved at bottom for
         * the two-line x-axis labels.
         */

        const graphBottom =
            containerBottom - 32;


        const graphWidth =
            graphRight -
            graphLeft;


        const graphHeight =
            graphBottom -
            graphTop;


        /* ------------------------------------------------------------------
           GRID LINES
           ------------------------------------------------------------------ */

        doc.setLineWidth(
            0.2
        );

        doc.setDrawColor(
            226,
            232,
            240
        );


        const gridLines = 3;


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
                ) * i;


            const y =
                graphTop +
                (
                    graphHeight /
                    gridLines
                ) * i;


            doc.line(
                graphLeft,
                y,
                graphRight,
                y
            );


            /* Y-axis number */

            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(
                6
            );

            doc.setTextColor(
                ...MUTED
            );


            doc.text(
                String(
                    Math.round(value)
                ),
                graphLeft - 3,
                y + 2,
                {
                    align: "right"
                }
            );
        }


        /* ------------------------------------------------------------------
           AXIS
           ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           NO ROUTES
           ------------------------------------------------------------------ */

        if (!routes.length) {

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
                "No route data available.",
                graphLeft +
                    graphWidth / 2,
                graphTop +
                    graphHeight / 2,
                {
                    align: "center"
                }
            );


            return (
                containerBottom +
                5
            );
        }


        /* ------------------------------------------------------------------
           POINT POSITIONS
           ------------------------------------------------------------------ */

        const pointSpacing =
            routes.length === 1
                ? 0
                : graphWidth /
                  (routes.length - 1);


        const points = [];


        routes.forEach(
            (route, index) => {

                const count =
                    counts[index];


                const x =
                    routes.length === 1
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


        /* ------------------------------------------------------------------
           GRAPH LINE
           
           Thin premium line.
           ------------------------------------------------------------------ */

        doc.setDrawColor(
            ...BLUE
        );


        doc.setLineWidth(
            0.9
        );


        for (
            let i = 0;
            i < points.length - 1;
            i++
        ) {

            doc.line(
                points[i].x,
                points[i].y,
                points[i + 1].x,
                points[i + 1].y
            );
        }


        /* ------------------------------------------------------------------
           POINTS + LABELS
           ------------------------------------------------------------------ */

        points.forEach(
            (point, index) => {

                /* ----------------------------------------------------------
                   Point
                   ---------------------------------------------------------- */

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
                    2.1,
                    "FD"
                );


                /* ----------------------------------------------------------
                   Count
                   ---------------------------------------------------------- */

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    5.8
                );

                doc.setTextColor(
                    ...DARK_BLUE
                );


                doc.text(
                    String(
                        point.count
                    ),
                    point.x,
                    point.y - 4,
                    {
                        align: "center"
                    }
                );


                /* ----------------------------------------------------------
                   FROM / TO
                   ---------------------------------------------------------- */

                const route =
                    routes[index];


                const from =
                    cleanEndpoint(
                        routeFrom(route)
                    );


                const to =
                    cleanEndpoint(
                        routeTo(route)
                    );


                function shorten(
                    text,
                    max
                ) {

                    if (
                        !text
                    ) {
                        return "";
                    }


                    if (
                        text.length <= max
                    ) {
                        return text;
                    }


                    return (
                        text.substring(
                            0,
                            max - 1
                        ) + "…"
                    );
                }


                const fromLabel =
                    shorten(
                        from,
                        13
                    );


                const toLabel =
                    shorten(
                        to,
                        13
                    );


                /* ----------------------------------------------------------
                   FROM LABEL
                   ---------------------------------------------------------- */

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    5.0
                );

                doc.setTextColor(
                    ...MUTED
                );


                doc.text(
                    fromLabel,
                    point.x,
                    graphBottom + 7,
                    {
                        align: "center"
                    }
                );


                /* ----------------------------------------------------------
                   TO LABEL
                   ---------------------------------------------------------- */

                doc.text(
                    toLabel
                        ? `- ${toLabel}`
                        : "",
                    point.x,
                    graphBottom + 13,
                    {
                        align: "center"
                    }
                );
            }
        );


        /* ------------------------------------------------------------------
           X AXIS TITLE
           ------------------------------------------------------------------ */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            6
        );

        doc.setTextColor(
            ...MUTED
        );


        doc.text(
            "Routes",
            graphLeft +
                graphWidth / 2,
            containerBottom - 8,
            {
                align: "center"
            }
        );


        /* ------------------------------------------------------------------
           Return next position
           ------------------------------------------------------------------ */

        return (
            containerBottom +
            5
        );
    }


    /* ======================================================================
       SUMMARY CARDS
    ====================================================================== */

    function drawSummary(
        doc,
        values,
        startY
    ) {

        const pageWidth =
            getPageWidth(doc);


        const left = 20;
        const right = 20;


        const availableWidth =
            pageWidth -
            left -
            right;


        const gap = 5;


        const cardWidth =
            (
                availableWidth -
                gap * 2
            ) / 3;


        const cardHeight =
            27;


        const cards = [

            {
                label: "Total Routes",
                value: values.totalRoutes
            },

            {
                label: "Visible Routes",
                value: values.visibleRoutes
            },

            {
                label: "Departures",
                value: values.totalDepartures
            },

            {
                label: "Buses Assigned",
                value: values.busesAssigned
            },

            {
                label: "Drivers Assigned",
                value: values.driversAssigned
            },

            {
                label: "Conductors Assigned",
                value: values.conductorsAssigned
            }

        ];


        /* ------------------------------------------------------------------
           Heading
           ------------------------------------------------------------------ */

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
            "Daily Summary",
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
            "Key operational statistics for the selected date.",
            left,
            startY + 7
        );


        /* ------------------------------------------------------------------
           Cards
           ------------------------------------------------------------------ */

        cards.forEach(
            (card, index) => {

                const row =
                    Math.floor(
                        index / 3
                    );


                const col =
                    index % 3;


                const x =
                    left +
                    col *
                    (
                        cardWidth +
                        gap
                    );


                const y =
                    startY +
                    13 +
                    row *
                    (
                        cardHeight +
                        gap
                    );


                /* Card */

                doc.setFillColor(
                    ...WHITE
                );

                doc.setDrawColor(
                    191,
                    219,
                    254
                );

                doc.setLineWidth(
                    0.55
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


                /* Blue accent */

                doc.setFillColor(
                    ...BLUE
                );


                doc.roundedRect(
                    x,
                    y,
                    3,
                    cardHeight,
                    2,
                    2,
                    "F"
                );


                /* Number */

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    14
                );

                doc.setTextColor(
                    ...DARK_BLUE
                );


                doc.text(
                    String(
                        card.value
                    ),
                    x + 9,
                    y + 12
                );


                /* Label */

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    6.8
                );

                doc.setTextColor(
                    ...MUTED
                );


                doc.text(
                    card.label,
                    x + 9,
                    y + 21
                );
            }
        );


        return (
            startY +
            13 +
            cardHeight * 2 +
            gap +
            5
        );
    }


    /* ======================================================================
       MAIN PDF CREATION
    ====================================================================== */

    async function createReport(
        routes,
        selectedDate
    ) {

        /* ------------------------------------------------------------------
           Check jsPDF
           ------------------------------------------------------------------ */

        if (
            !window.jspdf ||
            !window.jspdf.jsPDF
        ) {

            throw new Error(
                "jsPDF library is not loaded."
            );
        }


        /* ------------------------------------------------------------------
           Check AutoTable
           ------------------------------------------------------------------ */

        if (
            typeof window.jspdf.jsPDF.API.autoTable !==
            "function"
        ) {

            throw new Error(
                "jsPDF AutoTable plugin is not loaded."
            );
        }


        const {
            jsPDF
        } = window.jspdf;


        /* ------------------------------------------------------------------
           Create A4 portrait PDF
           ------------------------------------------------------------------ */

        const doc =
            new jsPDF({

                orientation:
                    "portrait",

                unit:
                    "mm",

                format:
                    "a4"
            });


        /* ------------------------------------------------------------------
           Load logo
           
           Logo becomes part of the PDF.
           ------------------------------------------------------------------ */

        const logoData =
            await loadLogo();


        /* ==================================================================
           STATISTICS
        ================================================================== */

        const totalRoutes =
            routes.length;


        const visibleRoutes =
            routes.filter(
                route =>
                    Boolean(
                        route?.visible
                    )
            ).length;


        const totalDepartures =
            routes.reduce(
                (
                    sum,
                    route
                ) =>
                    sum +
                    routeDepartures(
                        route
                    ).length,
                0
            );


        const busesAssigned =
            routes.reduce(
                (
                    sum,
                    route
                ) =>
                    sum +
                    routeDepartures(
                        route
                    ).filter(
                        dep =>
                            dep?.busId ||
                            dep?.bus_id ||
                            dep?.busPlate
                    ).length,
                0
            );


        const driversAssigned =
            routes.reduce(
                (
                    sum,
                    route
                ) =>
                    sum +
                    routeDepartures(
                        route
                    ).filter(
                        dep =>
                            dep?.driverId ||
                            dep?.driver_id ||
                            dep?.driverName
                    ).length,
                0
            );


        const conductorsAssigned =
            routes.reduce(
                (
                    sum,
                    route
                ) =>
                    sum +
                    routeDepartures(
                        route
                    ).filter(
                        dep =>
                            dep?.conductorId ||
                            dep?.conductor_id ||
                            dep?.conductorName
                    ).length,
                0
            );


        /* ==================================================================
           PAGE 1 HEADER
        ================================================================== */

        const pageWidth =
            getPageWidth(doc);


        const left = 20;
        const right = 20;


        /* ------------------------------------------------------------------
           Top blue strip
           ------------------------------------------------------------------ */

        doc.setFillColor(
            ...BLUE
        );


        doc.rect(
            0,
            0,
            pageWidth,
            4,
            "F"
        );


        /* ------------------------------------------------------------------
           LOGO
           ------------------------------------------------------------------ */

        if (logoData) {

            doc.addImage(
                logoData,
                "PNG",
                left,
                13,
                20,
                20,
                undefined,
                "FAST"
            );

        } else {

            /* Fallback logo */

            doc.setFillColor(
                ...BLUE
            );


            doc.roundedRect(
                left,
                13,
                20,
                20,
                3,
                3,
                "F"
            );


            doc.setFont(
                "helvetica",
                "bold"
            );

            doc.setFontSize(
                14
            );

            doc.setTextColor(
                ...WHITE
            );


            doc.text(
                "B",
                left + 10,
                26,
                {
                    align: "center"
                }
            );
        }


        /* ------------------------------------------------------------------
           BusPal title
           ------------------------------------------------------------------ */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            19
        );

        doc.setTextColor(
            ...DARK_BLUE
        );


        doc.text(
            "BusPal",
            left + 28,
            21
        );


        /* Subtitle */

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
            "Smart Bus Transportation Platform",
            left + 28,
            28
        );


        /* ------------------------------------------------------------------
           Report date card
           ------------------------------------------------------------------ */

        const dateBoxWidth =
            45;


        const dateBoxHeight =
            23;


        const dateBoxX =
            pageWidth -
            right -
            dateBoxWidth;


        const dateBoxY =
            13;


        doc.setFillColor(
            ...LIGHT_BLUE
        );

        doc.setDrawColor(
            191,
            219,
            254
        );

        doc.setLineWidth(
            0.5
        );


        doc.roundedRect(
            dateBoxX,
            dateBoxY,
            dateBoxWidth,
            dateBoxHeight,
            3,
            3,
            "FD"
        );


        /* Date label */

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
            "REPORT DATE",
            dateBoxX +
                dateBoxWidth / 2,
            dateBoxY + 8,
            {
                align: "center"
            }
        );


        /* Date */

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
            formatDate(
                selectedDate
            ),
            dateBoxX +
                dateBoxWidth / 2,
            dateBoxY + 16,
            {
                align: "center"
            }
        );


        /* ------------------------------------------------------------------
           Generated timestamp
           ------------------------------------------------------------------ */

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
            `Generated: ${new Date().toLocaleString("en-LK")}`,
            pageWidth - right,
            42,
            {
                align: "right"
            }
        );


        /* ------------------------------------------------------------------
           Header divider
           ------------------------------------------------------------------ */

        doc.setDrawColor(
            191,
            219,
            254
        );

        doc.setLineWidth(
            0.6
        );


        doc.line(
            left,
            48,
            pageWidth - right,
            48
        );


        /* ==================================================================
           REPORT TITLE
        ================================================================== */

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
            "Routes & Schedules Report",
            left,
            61
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
            `Daily operational overview for ${formatLongDate(selectedDate)}.`,
            left,
            68
        );


        /* ------------------------------------------------------------------
           Decoration
           ------------------------------------------------------------------ */

        doc.setFillColor(
            ...BLUE
        );


        doc.roundedRect(
            pageWidth -
                right -
                25,
            59,
            25,
            5,
            2.5,
            2.5,
            "F"
        );


        /* ==================================================================
           SUMMARY
        ================================================================== */

        let y =
            drawSummary(
                doc,
                {
                    totalRoutes,
                    visibleRoutes,
                    totalDepartures,
                    busesAssigned,
                    driversAssigned,
                    conductorsAssigned
                },
                80
            );


        /* ==================================================================
           GRAPH
        ================================================================== */

        y =
            drawLineGraph(
                doc,
                routes,
                y
            );


        /* ==================================================================
           PAGE 2
           
           Departure details deliberately begins
           on a new page.
        ================================================================== */

        doc.addPage();


        const page2Width =
            getPageWidth(doc);


        /* ------------------------------------------------------------------
           Page 2 top strip
           ------------------------------------------------------------------ */

        doc.setFillColor(
            ...BLUE
        );


        doc.rect(
            0,
            0,
            page2Width,
            3,
            "F"
        );


        /* ------------------------------------------------------------------
           Page 2 title
           ------------------------------------------------------------------ */

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            16
        );

        doc.setTextColor(
            ...DARK_BLUE
        );


        doc.text(
            "Departure Details",
            left,
            20
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
            `${totalDepartures} scheduled departure record${totalDepartures === 1 ? "" : "s"}`,
            left,
            27
        );


        /* ==================================================================
           TABLE DATA
        ================================================================== */

        const tableRows = [];


        routes.forEach(
            route => {

                const departures =
                    routeDepartures(
                        route
                    );


                /* ----------------------------------------------------------
                   No departures
                   ---------------------------------------------------------- */

                if (
                    !departures.length
                ) {

                    tableRows.push([

                        cleanRouteName(
                            route
                        ),

                        "—",

                        "Not scheduled",

                        "—",

                        "—",

                        money(
                            route?.fare
                        )

                    ]);


                    return;
                }


                /* ----------------------------------------------------------
                   Actual departures
                   ---------------------------------------------------------- */

                departures.forEach(
                    departure => {

                        tableRows.push([

                            cleanRouteName(
                                route
                            ),

                            getDepartureTime(
                                departure
                            ),

                            cleanValue(

                                departure?.busPlate ??
                                departure?.bus_plate ??
                                departure?.busNumber,

                                "Not assigned"
                            ),

                            cleanValue(

                                departure?.driverName ??
                                departure?.driver_name,

                                "Not assigned"
                            ),

                            cleanValue(

                                departure?.conductorName ??
                                departure?.conductor_name,

                                "Not assigned"
                            ),

                            money(
                                route?.fare
                            )

                        ]);
                    }
                );
            }
        );


        /* ------------------------------------------------------------------
           Empty state
           ------------------------------------------------------------------ */

        if (
            !tableRows.length
        ) {

            tableRows.push([

                "No routes available",

                "—",

                "—",

                "—",

                "—",

                "—"

            ]);
        }


        /* ==================================================================
           AUTO TABLE
        ================================================================== */

        doc.autoTable({

            startY:
                34,


            head: [[

                "Route",
                "Time",
                "Bus",
                "Driver",
                "Conductor",
                "Fare"

            ]],


            body:
                tableRows,


            margin: {

                left:
                    20,

                right:
                    20,

                bottom:
                    24

            },


            theme:
                "grid",


            styles: {

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


            headStyles: {

                fillColor:
                    BLUE,

                textColor:
                    WHITE,

                fontStyle:
                    "bold",

                fontSize:
                    7,

                cellPadding:
                    3.2

            },


            bodyStyles: {

                fillColor:
                    WHITE

            },


            alternateRowStyles: {

                fillColor:
                    LIGHT_GREY

            },


            columnStyles: {

                0: {

                    cellWidth:
                        47

                },


                1: {

                    cellWidth:
                        19,

                    halign:
                        "center"

                },


                2: {

                    cellWidth:
                        31

                },


                3: {

                    cellWidth:
                        31

                },


                4: {

                    cellWidth:
                        31

                },


                5: {

                    cellWidth:
                        22,

                    halign:
                        "right"

                }

            },


            didDrawPage:
                function () {

                    /*
                     * Blue strip on table continuation pages.
                     */

                    doc.setFillColor(
                        ...BLUE
                    );


                    doc.rect(
                        0,
                        0,
                        page2Width,
                        3,
                        "F"
                    );
                }

        });


        /* ==================================================================
           FOOTERS
        ================================================================== */

        const pageCount =
            doc.internal.getNumberOfPages();


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


        /* ==================================================================
           PDF METADATA
        ================================================================== */

        doc.setProperties({

            title:
                `BusPal Routes & Schedules Report - ${selectedDate}`,

            subject:
                "Daily Routes and Schedules Report",

            author:
                "BusPal",

            creator:
                "BusPal Smart Bus Transportation Platform",

            keywords:
                "BusPal, Routes, Schedules, Bus Transportation, Report"

        });


        return doc;
    }


    /* ======================================================================
       PREVIEW FUNCTION
       
       IMPORTANT:
       This opens the PDF in the browser viewer.
       It does NOT automatically download.
    ====================================================================== */

    window.downloadRouteReport =
        async function (
            routes,
            selectedDate
        ) {

            try {

                /* ----------------------------------------------------------
                   Safety
                   ---------------------------------------------------------- */

                if (
                    !Array.isArray(
                        routes
                    )
                ) {

                    routes = [];
                }


                if (
                    !selectedDate
                ) {

                    throw new Error(
                        "Report date is missing."
                    );
                }


                /* ----------------------------------------------------------
                   Optional loading toast
                   ---------------------------------------------------------- */

                if (
                    typeof toast ===
                    "function"
                ) {

                    toast(
                        "Preparing report preview..."
                    );
                }


                /* ----------------------------------------------------------
                   Create PDF
                   ---------------------------------------------------------- */

                const doc =
                    await createReport(
                        routes,
                        selectedDate
                    );


                /* ----------------------------------------------------------
                   Convert to Blob
                   ---------------------------------------------------------- */

                const pdfBlob =
                    doc.output(
                        "blob"
                    );


                /* ----------------------------------------------------------
                   Create temporary browser URL
                   ---------------------------------------------------------- */

                const pdfUrl =
                    URL.createObjectURL(
                        pdfBlob
                    );


                /* ----------------------------------------------------------
                   Open browser PDF viewer
                   ---------------------------------------------------------- */

                const previewWindow =
                    window.open(
                        pdfUrl,
                        "_blank"
                    );


                /* ----------------------------------------------------------
                   Popup blocked
                   ---------------------------------------------------------- */

                if (
                    !previewWindow
                ) {

                    URL.revokeObjectURL(
                        pdfUrl
                    );


                    throw new Error(
                        "PDF preview was blocked. Please allow pop-ups for localhost."
                    );
                }


                /*
                 * Do NOT call doc.save() here.
                 *
                 * This is what keeps the normal button
                 * in PREVIEW mode.
                 */


                /* ----------------------------------------------------------
                   Release object URL later
                   ---------------------------------------------------------- */

                setTimeout(
                    () => {

                        URL.revokeObjectURL(
                            pdfUrl
                        );

                    },
                    120000
                );


            } catch (error) {

                console.error(
                    "BusPal route report preview failed:",
                    error
                );


                if (
                    typeof toast ===
                    "function"
                ) {

                    toast(
                        error?.message ||
                        "Unable to generate report."
                    );

                } else {

                    alert(
                        error?.message ||
                        "Unable to generate report."
                    );
                }
            }
        };


    /* ======================================================================
       OPTIONAL DIRECT DOWNLOAD FUNCTION
       
       This is separate from the normal preview function.
    ====================================================================== */

    window.saveRouteReportDirectly =
        async function (
            routes,
            selectedDate
        ) {

            try {

                if (
                    !Array.isArray(
                        routes
                    )
                ) {

                    routes = [];
                }


                if (
                    !selectedDate
                ) {

                    throw new Error(
                        "Report date is missing."
                    );
                }


                /* Create PDF */

                const doc =
                    await createReport(
                        routes,
                        selectedDate
                    );


                /* Filename */

                const filename =
                    `BusPal_Routes_Report_${selectedDate}.pdf`;


                /*
                 * Direct download.
                 *
                 * Logo is already embedded.
                 */

                doc.save(
                    filename
                );


            } catch (error) {

                console.error(
                    "Direct PDF download failed:",
                    error
                );


                if (
                    typeof toast ===
                    "function"
                ) {

                    toast(
                        error?.message ||
                        "Unable to download report."
                    );

                } else {

                    alert(
                        error?.message ||
                        "Unable to download report."
                    );
                }
            }
        };


})();